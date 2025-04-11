import { Injectable } from '@nestjs/common';
import { ServiceInfoDto } from './dto/service-info.dto'

@Injectable()
export class ServiceRegistryService {
  private services: Map<string, ServiceInfoDto> = new Map();

  registerService(serviceInfo: ServiceInfoDto): void {
    this.services.set(serviceInfo.serviceName, serviceInfo);
  }

  deregisterService(serviceName: string): void {
    this.services.delete(serviceName);
  }

  getServices(): ServiceInfoDto[] {
    return Array.from(this.services.values());
  }

  getService(serviceName: string): ServiceInfoDto | undefined {
    return this.services.get(serviceName);
  }
}