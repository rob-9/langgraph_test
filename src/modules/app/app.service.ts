import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHealth() {
    return {
      postgres: true,
    };
  }

  getStatus() {
    const uptime = process.uptime();
    const d = Math.floor(uptime / (3600 * 24));
    const h = Math.floor((uptime % (3600 * 24)) / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    const humanReadableUptime = `${d}d ${h}h ${m}m ${s}s`;

    return {
      serverName: 'api-gw',
      uptime: humanReadableUptime,
      stage: this.configService.get('stage'),
      release: this.configService.get('release'),
      version: this.configService.get('version'),
      buildTime: this.configService.get('buildTime'),
    };
  }
}
