import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS for frontend (development and Docker)
    app.enableCors({
        origin: [
            'http://localhost:4200',
            'http://localhost',
            'https://padel-tournament-frontend.onrender.com',
        ],
        credentials: true,
    });

    // Enable validation globally
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    );

    const port = process.env.PORT || 3000;
    await app.listen(port);

    console.log(`🚀 Padel Tournament API running on http://localhost:${port}`);
}

bootstrap();
