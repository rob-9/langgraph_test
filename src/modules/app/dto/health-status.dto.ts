import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class HealthStatusDto {
  @Expose()
  @ApiProperty({
    description: 'PostgresDB up & running',
    example: 'true',
  })
  public readonly postgres: boolean;

  constructor(data: HealthStatusDto) {
    this.postgres = data.postgres;
  }
}
