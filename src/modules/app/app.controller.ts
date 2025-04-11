import { Controller, Get, Header } from '@nestjs/common';

import { ApiStatusDto } from '~modules/app/dto/api-status.dto';
import { HealthStatusDto } from '~modules/app/dto/health-status.dto';

import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-cache, no-store')
  public async getStatus(): Promise<ApiStatusDto> {
    return new ApiStatusDto(this.appService.getStatus());
  }

  @Get('health')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-cache, no-store')
  public async getHealth(): Promise<HealthStatusDto> {
    return new HealthStatusDto(this.appService.getHealth());
  }
}
