import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

type PendingUploadItem = {
  chatId: string;
  messageThreadId?: number;
  pdfFileName: string;
  total: number;
  firstTail: string;
  lastTail: string;
  createdAt: number;
};

type ByeastsideUploadResponse = {
  id?: number;
  name?: string;
  status?: string;
  publicUrl?: string;
  createdAt?: string;
};

export type BarcodeResultItem = {
  code: string;
  status: 'success' | 'failed';
  error?: string;
};

export type BarcodeResponse = {
  total: number;
  success: number;
  failed: number;
  pdf_filename?: string;
  pdf_url?: string;
  results: BarcodeResultItem[];
};

@Injectable()
export class BarcodesService {
  constructor(private readonly config: ConfigService) {}

  private readonly logger = new Logger(BarcodesService.name);

  private readonly pendingUploads = new Map<string, PendingUploadItem>();

  private getPngDimensions(buffer: Buffer): { width: number; height: number } {
    if (buffer.length < 24) {
      throw new Error('Invalid PNG data');
    }

    const pngSignature = '89504e470d0a1a0a';
    const signature = buffer.subarray(0, 8).toString('hex');
    if (signature !== pngSignature) {
      throw new Error('Unsupported image format');
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (!width || !height) {
      throw new Error('Invalid PNG dimensions');
    }

    return { width, height };
  }

  private get outputDir(): string {
    const configured = this.config.get<string>('OUTPUT_DIR') || './storage/barcodes/output';
    return path.resolve(configured);
  }

  private get baseUrl(): string {
    const configured = this.config.get<string>('BASE_URL') || '';
    return configured.replace(/\/$/, '');
  }

  private get maxCodes(): number {
    return this.config.get<number>('MAX_CODES') ?? 500;
  }

  private get byeastsideUploadUrl(): string {
    const configured = this.config.get<string>('BYEASTSIDE_UPLOAD_URL');
    if (configured && configured.trim()) {
      return configured.trim();
    }

    const base = this.config
      .get<string>('BYEASTSIDE_API_BASE', 'https://byeastside.uk/api/customer/pdfs')
      .replace(/\/$/, '');
    return `${base}/upload`;
  }

  private prunePendingUploads(): void {
    const ttlMs = 10 * 60 * 1000;
    const now = Date.now();

    for (const [key, value] of this.pendingUploads.entries()) {
      if (now - value.createdAt > ttlMs) {
        this.pendingUploads.delete(key);
      }
    }
  }

  private createPendingUploadId(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildBarcodeSummary(codes: string[]): { total: number; firstTail: string; lastTail: string } {
    const total = codes.length;
    const first = total > 0 ? codes[0] : '';
    const last = total > 0 ? codes[total - 1] : '';
    return {
      total,
      firstTail: first.slice(-2),
      lastTail: last.slice(-2),
    };
  }

  private formatToHoChiMinhTime(value?: string): string {
    if (!value) return '(không có)';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';

    const hh = getPart('hour');
    const mm = getPart('minute');
    const ss = getPart('second');
    const dd = getPart('day');
    const mo = getPart('month');
    const yyyy = getPart('year');

    return `${hh}:${mm}:${ss} - ${dd}/${mo}/${yyyy} (GMT+7)`;
  }

  private buildFileUrl(fileName: string): string {
    if (!this.baseUrl) return fileName;
    return `${this.baseUrl}/${encodeURIComponent(fileName)}`;
  }

  parseCodes(input: string[]): { validCodes: string[]; invalidCodes: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();

    for (const raw of input) {
      const code = String(raw ?? '').trim();
      if (!code) continue;

      if (!/^\d+$/.test(code)) {
        if (!invalid.includes(code)) invalid.push(code);
        continue;
      }

      if (seen.has(code)) continue;
      seen.add(code);
      valid.push(code);
    }

    if (valid.length > this.maxCodes) {
      throw new BadRequestException(`Maximum ${this.maxCodes} codes per request`);
    }

    if (valid.length === 0 && invalid.length === 0) {
      throw new BadRequestException('No barcode codes provided');
    }

    return { validCodes: valid, invalidCodes: invalid };
  }

  parseTextBody(body: unknown): string[] {
    const raw = typeof body === 'string' ? body : '';
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private async ensureOutputDir(): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
  }

  private async createPdf(codes: string[]): Promise<string> {
    await this.ensureOutputDir();
    const fileName = `barcodes_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    await new Promise<void>(async (resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('error', reject);
      doc.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await writeFile(filePath, buffer);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      try {
        for (const code of codes) {
          const pngBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: code,
            includetext: true,
            textxalign: 'center',
            scale: 3,
            height: 12,
            backgroundcolor: 'FFFFFF',
          });

          const image = this.getPngDimensions(pngBuffer);
          const horizontalPadding = 18;
          const topPadding = 14;
          const bottomPadding = 16;

          const pageWidth = image.width + horizontalPadding * 2;
          const pageHeight = topPadding + image.height + bottomPadding;

          doc.addPage({
            size: [pageWidth, pageHeight],
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });

          doc.image(pngBuffer, horizontalPadding, topPadding, {
            width: image.width,
            height: image.height,
          });
        }
        doc.end();
      } catch (error) {
        reject(error);
      }
    });

    return fileName;
  }

  async generateBarcodes(codes: string[]): Promise<BarcodeResponse> {
    const { validCodes, invalidCodes } = this.parseCodes(codes);

    const results: BarcodeResultItem[] = [];

    for (const badCode of invalidCodes) {
      results.push({
        code: badCode,
        status: 'failed',
        error: 'Code must contain only digits',
      });
    }

    for (const code of validCodes) {
      results.push({
        code,
        status: 'success',
      });
    }

    const success = results.filter((item) => item.status === 'success').length;
    const failed = results.filter((item) => item.status === 'failed').length;

    const response: BarcodeResponse = {
      total: results.length,
      success,
      failed,
      results,
    };

    if (validCodes.length > 0) {
      try {
        const pdfName = await this.createPdf(validCodes);
        response.pdf_filename = pdfName;
        response.pdf_url = this.buildFileUrl(pdfName);
      } catch (error) {
        throw new InternalServerErrorException('Failed to create barcode PDF');
      }
    }

    return response;
  }

  async sendBarcodesToTelegram(input: {
    chatId: string;
    messageThreadId?: number;
    codes: string[];
  }): Promise<{ status: 'sent'; telegram: unknown; payload: BarcodeResponse }> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new BadRequestException('Missing TELEGRAM_BOT_TOKEN');
    }

    const payload = await this.generateBarcodes(input.codes);
    const successful = payload.results.filter((item) => item.status === 'success');
    if (successful.length === 0) {
      throw new BadRequestException('No valid barcode generated to send');
    }

    const documentFileName = payload.pdf_filename;

    if (!documentFileName) {
      throw new InternalServerErrorException('Unable to determine document file to send');
    }

    const filePath = path.join(this.outputDir, documentFileName);
    const fileBuffer = await readFile(filePath);

    const form = new FormData();
    form.set('chat_id', input.chatId);
    if (typeof input.messageThreadId === 'number') {
      form.set('message_thread_id', String(input.messageThreadId));
    }
    form.set('caption', `Generated ${successful.length} barcode(s) in PDF`);
    form.set('document', new Blob([fileBuffer]), documentFileName);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`Telegram sendDocument failed: ${response.status} ${detail}`);
    }

    const telegramResult = await response.json();

    const successCodes = successful.map((item) => item.code);
    const summary = this.buildBarcodeSummary(successCodes);
    const pendingId = this.createPendingUploadId();

    this.prunePendingUploads();
    this.pendingUploads.set(pendingId, {
      chatId: input.chatId,
      messageThreadId: input.messageThreadId,
      pdfFileName: documentFileName,
      total: summary.total,
      firstTail: summary.firstTail,
      lastTail: summary.lastTail,
      createdAt: Date.now(),
    });

    await this.sendUploadPromptToTelegram({
      chatId: input.chatId,
      messageThreadId: input.messageThreadId,
      total: summary.total,
      firstTail: summary.firstTail,
      lastTail: summary.lastTail,
      pendingId,
    });

    return {
      status: 'sent',
      telegram: telegramResult,
      payload,
    };
  }

  private async sendUploadPromptToTelegram(input: {
    chatId: string;
    messageThreadId?: number;
    total: number;
    firstTail: string;
    lastTail: string;
    pendingId: string;
  }): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new BadRequestException('Missing TELEGRAM_BOT_TOKEN');
    }

    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text:
        `Đã tạo ${input.total} barcode.\n` +
        `2 số cuối barcode đầu tiên: ${input.firstTail}\n` +
        `2 số cuối barcode cuối cùng: ${input.lastTail}\n\n` +
        'Bạn có muốn upload file PDF này lên BYEASTSIDE không?',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Có', callback_data: `byeastside_upload_yes:${input.pendingId}` },
            { text: 'Không', callback_data: `byeastside_upload_no:${input.pendingId}` },
          ],
        ],
      },
    };

    if (typeof input.messageThreadId === 'number') {
      payload.message_thread_id = input.messageThreadId;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`Telegram sendMessage failed: ${response.status} ${detail}`);
    }
  }

  async handleUploadDecisionFromCallback(input: {
    callbackQueryId: string;
    callbackData: string;
    messageThreadId?: number;
  }): Promise<{ status: 'uploaded' | 'skipped' | 'expired'; upload?: unknown }> {
    const yesPrefix = 'byeastside_upload_yes:';
    const noPrefix = 'byeastside_upload_no:';

    if (!input.callbackData.startsWith(yesPrefix) && !input.callbackData.startsWith(noPrefix)) {
      await this.answerCallbackQuery(input.callbackQueryId, 'Thao tác không hợp lệ.');
      return { status: 'expired' };
    }

    const isYes = input.callbackData.startsWith(yesPrefix);
    const pendingId = input.callbackData.slice((isYes ? yesPrefix : noPrefix).length);
    const pending = this.pendingUploads.get(pendingId);

    if (!pending) {
      await this.answerCallbackQuery(input.callbackQueryId, 'Yêu cầu đã hết hạn hoặc không tồn tại.');
      return { status: 'expired' };
    }

    if (!isYes) {
      this.pendingUploads.delete(pendingId);
      await this.answerCallbackQuery(input.callbackQueryId, 'Đã bỏ qua upload BYEASTSIDE.');
      await this.sendTextToTelegram({
        chatId: pending.chatId,
        messageThreadId: input.messageThreadId ?? pending.messageThreadId,
        text: 'Đã hủy upload file PDF lên BYEASTSIDE.',
      });
      return { status: 'skipped' };
    }

    try {
      const uploadResult = await this.uploadPdfToByeastside(pending.pdfFileName);
      this.pendingUploads.delete(pendingId);
      await this.answerCallbackQuery(input.callbackQueryId, 'Upload BYEASTSIDE thành công.');

      const publicUrlText = uploadResult.publicUrl ?? '(không có)';
      const createdAtText = this.formatToHoChiMinhTime(uploadResult.createdAt);

      await this.sendTextToTelegram({
        chatId: pending.chatId,
        messageThreadId: input.messageThreadId ?? pending.messageThreadId,
        text:
          `Đã upload PDF lên BYEASTSIDE thành công.\n` +
          `Tổng barcode: ${pending.total}\n` +
          `2 số cuối đầu tiên: ${pending.firstTail}\n` +
          `2 số cuối cuối cùng: ${pending.lastTail}\n` +
          `Public URL: ${publicUrlText}\n` +
          `Created At: ${createdAtText}`,
      });
      return { status: 'uploaded', upload: uploadResult };
    } catch (error: any) {
      await this.answerCallbackQuery(input.callbackQueryId, 'Upload thất bại.');
      await this.sendTextToTelegram({
        chatId: pending.chatId,
        messageThreadId: input.messageThreadId ?? pending.messageThreadId,
        text: `Upload BYEASTSIDE thất bại: ${error?.message ?? 'Unknown error'}`,
      });
      return { status: 'expired' };
    }
  }

  private async uploadPdfToByeastside(pdfFileName: string): Promise<ByeastsideUploadResponse> {
    const apiKey = this.config.get<string>('BYEASTSIDE_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Missing BYEASTSIDE_API_KEY');
    }

    const filePath = path.join(this.outputDir, pdfFileName);
    const fileBuffer = await readFile(filePath);
    const form = new FormData();
    form.set('file', new Blob([fileBuffer]), pdfFileName);

    const response = await fetch(this.byeastsideUploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`BYEASTSIDE upload failed: ${response.status} ${detail}`);
    }

    return response.json() as Promise<ByeastsideUploadResponse>;
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('Skip answerCallbackQuery because TELEGRAM_BOT_TOKEN is missing');
      return;
    }

    const payload: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };

    if (text) {
      payload.text = text;
      payload.show_alert = false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(`Telegram answerCallbackQuery failed: ${response.status} ${detail}`);
      }
    } catch (error: any) {
      this.logger.warn(`Telegram answerCallbackQuery fetch failed: ${error?.message ?? 'Unknown error'}`);
    }
  }

  async sendTextToTelegram(input: { chatId: string; messageThreadId?: number; text: string }): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new BadRequestException('Missing TELEGRAM_BOT_TOKEN');
    }

    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: true,
    };

    if (typeof input.messageThreadId === 'number') {
      payload.message_thread_id = input.messageThreadId;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`Telegram sendMessage failed: ${response.status} ${detail}`);
    }
  }
}
