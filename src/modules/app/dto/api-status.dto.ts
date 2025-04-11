import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ApiStatusDto {
  @Expose()
  @ApiProperty({
    description: 'Server name',
    example: 'user-ms',
  })
  public readonly serverName: string;

  @Expose()
  @ApiProperty({
    description: 'Api Status Uptime',
    example: '1d 12h 10m 30s',
  })
  public readonly uptime: string;

  @Expose()
  @ApiProperty({
    description: 'Api Status Stage',
    example: 'project-dev',
  })
  public readonly stage: string;

  @Expose()
  @ApiProperty({
    description: 'Api Status Version',
    example: 'project-dev-1.0.0',
  })
  public readonly version: string;

  @Expose()
  @ApiProperty({
    description: 'Api Status Release (Git Hash Format)',
    example: '9eabf5b536662000f79978c4d1b6e4eff5c8d785',
  })
  public readonly release: string;

  @Expose()
  @ApiProperty({
    description: 'Api Status Build Time',
    example: '2022-01-01T10:00:00.000Z',
  })
  public readonly buildTime: string;

  constructor(data: ApiStatusDto) {
    this.serverName = data.serverName;
    this.buildTime = data.buildTime;
    this.release = data.release;
    this.stage = data.stage;
    this.uptime = data.uptime;
    this.version = data.version;
  }
}
