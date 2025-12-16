var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
let MailerService = class MailerService {
    constructor(config) {
        this.from = config.get('OTP_EMAIL_FROM') ?? 'no-reply@example.com';
        this.transporter = nodemailer.createTransport({
            host: config.get('SMTP_HOST'),
            port: config.get('SMTP_PORT'),
            auth: {
                user: config.get('SMTP_USER'),
                pass: config.get('SMTP_PASS'),
            },
        });
    }
    async send(params) {
        await this.transporter.sendMail({
            from: this.from,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
        });
    }
};
MailerService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [ConfigService])
], MailerService);
export { MailerService };
//# sourceMappingURL=mailer.service.js.map