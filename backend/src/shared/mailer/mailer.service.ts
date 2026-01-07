import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: Transporter;
  private from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.getOrThrow<string>('OTP_EMAIL_FROM', { infer: true });
    const host = this.config.getOrThrow<string>('SMTP_HOST', { infer: true });
    const port = this.config.getOrThrow<number>('SMTP_PORT', { infer: true });
    const secure = this.config.get<boolean>('SMTP_SECURE', { infer: true }) ?? true;
    const user = this.config.getOrThrow<string>('SMTP_USER', { infer: true });
    const pass = this.config.getOrThrow<string>('SMTP_PASS', { infer: true });
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      debug: true,
      auth: {
        user,
        pass,
      },
    });
  }

  async send(params: { to: string; subject: string; text?: string; html?: string }) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Mailer send failed', err);
      throw err;
    }
  }
}
