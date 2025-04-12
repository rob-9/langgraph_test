
import { ApiProperty, } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

export class ServiceEndPointDto {
  @Expose()
  @ApiProperty()
  @IsString()
  uri: string;

  @Expose()
  @ApiProperty()
  @IsString()
  description: string;
}

export class ServiceInfoDto {
  @Expose()
  @IsString()
  @ApiProperty({
    description: 'Name of the service',
    example: 'hr-ma',
  })
  public readonly serviceName: string;

  @Expose()
  @IsString()
  @ApiProperty({
    description: "Description of this agent's specialty.",
    example: 'I am a data retrieval agent. I can retrieve HR, FP&A, CAP data.',
  })
  public readonly description: string;

  @Expose()
  @IsString()
  @ApiProperty({
    description: 'Service URL',
    example: 'http://hr-ma:8001',
  })
  public readonly serviceUrl: string;

  @Expose()
  @IsString()
  @ApiProperty({
    description: 'Health check URL',
    example: 'http://hr-ma:8001/health',
  })
  public readonly healthCheckUrl: string;

  @Expose()
  @IsString()
  @ApiProperty({
    description: 'Version of the service (semver syntax).',
    example: '1.0.3-test.0+5c35621',
  })
  public readonly version: string;

  @Expose()
  @ValidateNested({ each: true })
  @Type(() => ServiceEndPointDto)
  @ApiProperty({
    type: [ServiceEndPointDto],
    description: 'List of endpoints supported.',
    example: [
      { uri: "/api/v1/query", description: "Query interface" },
      { uri: "/api/v2/query", description: "Improved query interface" }
    ]
  })

  public readonly endpoints: ServiceEndPointDto[];
}
