import { NestFactory } from '@nestjs/core';
import { AppModule } from '~modules/app/app.module';
import { logger } from 'zyprova-common-lib/dist/logging/logger';
import { ConfigService } from '@nestjs/config';
import { corsSetup, HttpConfig, swaggerSetup } from 'zyprova-common-lib';
import { globalPipes } from '~modules/app/app.pipes';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger,
    abortOnError: false, // force nest.js to bubble up exceptions
  });

  const configService = app.get(ConfigService);
  const httpConfig = configService.getOrThrow<HttpConfig>('http');

  // setup CORS
  corsSetup(app, httpConfig.cors);

  // global pipes
  globalPipes(app);

  // swagger
  swaggerSetup(app);

  await app.listen(httpConfig.port, httpConfig.hostname);
  logger.log(`Server started at ${httpConfig.hostname}:${httpConfig.port}`, 'Bootstrap');
}

bootstrap().catch((e) => {
  logger.error(e.message, e, 'Bootstrap');
  process.exit(1);
});
