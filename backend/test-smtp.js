// test-smtp.js
import nodemailer from 'nodemailer';

// Hardcoded settings for quick manual test
const SMTP_HOST = 'mail.privateemail.com';
const SMTP_PORT = 465;
const SMTP_SECURE = true;
const SMTP_USER = 'admin@sclabel.io';
const SMTP_PASS = 'Gt3123!@#';

// Sender to test (matches OTP_EMAIL_FROM expectation)
const FROM = 'no-reply@sclabel.io';
const TO = 'giangle96bg@gmail.com';

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: true,
    debug: true,
});

const mailOptions = {
    from: FROM,
    to: TO,
    subject: 'SMTP test',
    text: 'hello',
};

transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error(err);
    else console.log('sent', info.response);
});