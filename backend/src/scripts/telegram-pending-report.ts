import cron from 'node-cron';
import { Client } from 'pg';

const TZ = 'Asia/Ho_Chi_Minh';
const DEFAULT_CRON = '0 21 * * *';

type PendingOrderRow = {
  id: string;
  email: string | null;
  total_cost: string | number;
  created_at: string | Date;
};

type TelegramTarget = {
  chatId: string | number;
  threadId?: number;
};

const getEnv = (key: string, required = true): string => {
  const value = process.env[key];
  if (!value && required) {
    throw new Error(`Missing env: ${key}`);
  }
  return value ?? '';
};

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const formatDateTime = (value: Date): string =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);

const getDbClient = () => {
  const databaseUrl = getEnv('DATABASE_URL');
  const sslEnabled = (process.env.DB_SSL || '').toLowerCase() === 'true';
  return new Client({
    connectionString: databaseUrl,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });
};

const fetchPendingOrders = async (): Promise<PendingOrderRow[]> => {
  const client = getDbClient();
  await client.connect();
  try {
    const result = await client.query<PendingOrderRow>(
      `
      SELECT o.id,
             u.email,
             o.total_cost,
             o.created_at
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
       WHERE o.order_status = 'pending'
         AND o.archived = false
       ORDER BY o.created_at ASC
      `,
    );
    return result.rows;
  } finally {
    await client.end();
  }
};

const buildMessage = (orders: PendingOrderRow[]): string => {
  if (orders.length === 0) {
    return 'Không có order pending hôm nay.';
  }

  const lines = orders.map((order) => {
    const amount = Number(order.total_cost ?? 0);
    const created = new Date(order.created_at);
    const user = order.email || 'N/A';
    return `- #${escapeHtml(order.id)} | ${escapeHtml(user)} | ${escapeHtml(formatAmount(amount))} | ${escapeHtml(formatDateTime(created))}`;
  });

  return [
    '<b>📌 Thông báo Order Pending (21:00)</b>',
    '',
    `Tổng số: ${orders.length}`,
    '',
    'Danh sách:',
    ...lines,
    '',
    'Vui lòng kiểm tra và xử lý.',
  ].join('\n');
};

const sendTelegramMessage = async (target: TelegramTarget, text: string) => {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload: Record<string, any> = {
    chat_id: target.chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (target.threadId != null) {
    payload.message_thread_id = target.threadId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${detail}`);
  }
};

const resolveTelegramTarget = async (): Promise<TelegramTarget> => {
  const directChatId = process.env.TELEGRAM_CHAT_ID;
  const directThreadId = process.env.TELEGRAM_TOPIC_ID;

  if (directChatId) {
    return {
      chatId: directChatId,
      threadId: directThreadId ? Number(directThreadId) : undefined,
    };
  }

  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Telegram getUpdates failed: ${response.status}`);
  }

  const body = (await response.json()) as { ok: boolean; result: any[] };
  const updates = body?.result ?? [];
  const groupTitle = process.env.TELEGRAM_GROUP_TITLE?.trim();

  for (let i = updates.length - 1; i >= 0; i -= 1) {
    const update = updates[i];
    const message = update?.message || update?.edited_message || update?.channel_post || update?.edited_channel_post;
    const chat = message?.chat;
    if (!chat) continue;
    if (chat.type !== 'group' && chat.type !== 'supergroup') continue;
    if (groupTitle && chat.title !== groupTitle) continue;

    return {
      chatId: chat.id,
      threadId: message?.message_thread_id,
    };
  }

  throw new Error('Unable to resolve Telegram chat_id. Send a message in the target group first, then retry.');
};

const runOnce = async () => {
  const target = await resolveTelegramTarget();
  const orders = await fetchPendingOrders();
  const message = buildMessage(orders);
  await sendTelegramMessage(target, message);
};

const main = async () => {
  const cronExpr = process.env.TELEGRAM_CRON || DEFAULT_CRON;
  const runOnStart = (process.env.TELEGRAM_RUN_ON_START || '').toLowerCase() === 'true';
  const exitAfterRun = (process.env.TELEGRAM_EXIT_AFTER_RUN || '').toLowerCase() === 'true';

  if (runOnStart) {
    await runOnce();
    if (exitAfterRun) {
      return;
    }
  }

  cron.schedule(
    cronExpr,
    () => {
      runOnce().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[telegram-pending-report] Failed:', err);
      });
    },
    { timezone: TZ },
  );

  // eslint-disable-next-line no-console
  console.log(`[telegram-pending-report] Scheduled ${cronExpr} (${TZ}).`);
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[telegram-pending-report] Fatal:', err);
  process.exit(1);
});
