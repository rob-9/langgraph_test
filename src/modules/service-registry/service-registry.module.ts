import { Module } from '@nestjs/common';
import { ServiceRegistryService } from './service-registry.service';
import { ServiceRegistryController } from './service-registry.controller';

@Module({
  controllers: [ServiceRegistryController],
  providers: [ServiceRegistryService],
})
export class ServiceRegistryModule {}
