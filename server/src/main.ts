import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiError } from './common/api-error';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { createUuidV7 } from './common/uuid-v7';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use((request: any, response: any, next: () => void) => {
    const requestId = `req_${createUuidV7()}`;
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const fields = Object.fromEntries(
          errors.map((error) => [
            error.property,
            Object.values(error.constraints ?? {}).join('；')
          ])
        );
        return new ApiError(
          'JIJU_VALIDATION_4221',
          422,
          '内容不符合要求，请修改后重试',
          { fields }
        );
      }
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
