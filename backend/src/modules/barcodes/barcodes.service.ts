import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

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
      const doc = new PDFDocument({ autoFirstPage: false, size: 'A4', margin: 36 });
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

          doc.addPage();
          doc.fontSize(14).text(`Barcode: ${code}`, { align: 'center' });
          const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          doc.image(pngBuffer, doc.page.margins.left, 100, {
            fit: [maxWidth, 300],
            align: 'center',
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
    return {
      status: 'sent',
      telegram: telegramResult,
      payload,
    };
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
