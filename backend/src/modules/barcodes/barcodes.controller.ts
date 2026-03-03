import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import { BarcodesService } from './barcodes.service.js';
import { CreateTelegramBarcodesDto } from './dto/create-telegram-barcodes.dto.js';

@Controller()
export class BarcodesController {
  constructor(private readonly barcodesService: BarcodesService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'barcode-api',
    };
  }

  @Post('barcodes')
  async createBarcodes(@Req() req: Request, @Body() body: any) {
    const contentType = String(req.headers['content-type'] ?? '').toLowerCase();

    if (contentType.includes('text/plain')) {
      const codes = this.barcodesService.parseTextBody(req.body);
      return this.barcodesService.generateBarcodes(codes);
    }

    const codes = Array.isArray(body?.codes) ? body.codes : [];
    if (codes.length === 0) {
      throw new BadRequestException('codes must be a non-empty array for JSON input');
    }

    return this.barcodesService.generateBarcodes(codes);
  }

  @Post('telegram/barcodes')
  async sendTelegramBarcodes(@Body() body: CreateTelegramBarcodesDto) {
    if (!Array.isArray(body.codes) || body.codes.length === 0) {
      throw new BadRequestException('codes must be a non-empty array');
    }

    return this.barcodesService.sendBarcodesToTelegram({
      chatId: body.chat_id,
      messageThreadId: body.message_thread_id,
      codes: body.codes,
    });
  }

  @Post('telegram/webhook')
  async telegramWebhook(@Body() update: any) {
    const callbackQuery = update?.callback_query;
    if (callbackQuery?.id && callbackQuery?.data) {
      const callbackThreadId =
        typeof callbackQuery.message.message_thread_id === 'number'
          ? callbackQuery.message.message_thread_id
          : undefined;

      const callbackResult = await this.barcodesService.handleUploadDecisionFromCallback({
        callbackQueryId: String(callbackQuery.id),
        callbackData: String(callbackQuery.data),
        messageThreadId: callbackThreadId,
      });

      return { ok: true, status: 'callback-processed', result: callbackResult };
    }

    const message = update?.message ?? update?.edited_message;
    if (!message?.text || !message?.chat?.id) {
      return { ok: true, ignored: 'no-message-text' };
    }

    if (message?.from?.is_bot) {
      return { ok: true, ignored: 'bot-message' };
    }

    const text = String(message.text).trim();
    if (!text.startsWith('/barcode')) {
      return { ok: true, ignored: 'not-barcode-command' };
    }

    const payload = text.replace(/^\/barcode(@\w+)?/i, '').trim();
    const codes = payload
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/\s+/g, ''));

    const chatId = String(message.chat.id);
    const threadId = typeof message.message_thread_id === 'number' ? message.message_thread_id : undefined;

    if (codes.length === 0) {
      await this.barcodesService.sendTextToTelegram({
        chatId,
        messageThreadId: threadId,
        text: 'Usage: /barcode 9200190388763745644413 9200190388763745254315',
      });
      return { ok: true, status: 'usage-sent' };
    }

    try {
      const sent = await this.barcodesService.sendBarcodesToTelegram({
        chatId,
        messageThreadId: threadId,
        codes,
      });
      return { ok: true, status: 'sent', result: sent.payload };
    } catch (error: any) {
      const messageText = error?.message ?? 'Failed to generate barcode PDF';
      await this.barcodesService.sendTextToTelegram({
        chatId,
        messageThreadId: threadId,
        text: `Barcode failed: ${messageText}`,
      });
      return { ok: true, status: 'failed', error: messageText };
    }
  }
}
