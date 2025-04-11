import { Controller, Post, Delete, Get, Body, Param } from '@nestjs/common';
import { ServiceRegistryService } from './service-registry.service';
import { ServiceInfoDto } from './dto/service-info.dto'

@Controller('/api/v1/services')
export class ServiceRegistryController {
  constructor(private readonly serviceRegistry: ServiceRegistryService) {}

  @Post('register')
  registerService(@Body() serviceInfo: ServiceInfoDto ) {
    this.serviceRegistry.registerService(serviceInfo);
    return { message: 'Service registered successfully' };
  }

  @Delete('deregister/:serviceName')
  deregisterService(@Param('serviceName') serviceName: string) {
    this.serviceRegistry.deregisterService(serviceName);
    return { message: 'Service deregistered successfully' };
  }

  @Get()
  getServices() {
    return this.serviceRegistry.getServices();
  }

  @Get(':serviceName')
  getService(@Param('serviceName') serviceName: string) {
    const service = this.serviceRegistry.getService(serviceName);
    if (!service) {
      return { message: 'Service not found' };
    }
    return service;
  }
}
