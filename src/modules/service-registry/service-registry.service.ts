import { Injectable } from '@nestjs/common';
import { ServiceInfoReqDto, ServiceInfoResDto } from './dto/service-info.dto'

@Injectable()
export class ServiceRegistryService {
  private services: Map<string, ServiceInfoReqDto> = new Map();

  registerService(serviceInfo: ServiceInfoReqDto): ServiceInfoResDto {
    this.services.set(serviceInfo.serviceName, serviceInfo);
    return {
      serviceName: "zai-ma",
      serviceToken: "zai-ma-random",
      version: "0.0.1"
    }
  }

  deregisterService(serviceName: string): void {
    this.services.delete(serviceName);
  }

  getServices(): ServiceInfoReqDto[] {
    return Array.from(this.services.values());
  }

  getService(serviceName: string): ServiceInfoReqDto | undefined {
    return this.services.get(serviceName);
  }
}