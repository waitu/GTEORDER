import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './modules/app.module.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const config = app.get(ConfigService);
    const port = config.get('PORT') ?? 3000;
    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`API running on port ${port}`);
}
bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Bootstrap error', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map