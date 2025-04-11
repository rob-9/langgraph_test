import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleRootFactory, httpConfigFactory, swaggerConfigFactory } from 'zyprova-common-lib';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServiceRegistryModule } from '~modules/service-registry/service-registry.module';
import { AiModule } from '~modules/ai/ai.module';

@Module({
  imports: [
    configModuleRootFactory(),
    ConfigModule.forFeature(httpConfigFactory),
    ConfigModule.forFeature(swaggerConfigFactory),
    ServiceRegistryModule,
    AiModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
