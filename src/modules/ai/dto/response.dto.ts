
import { ApiProperty, } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString } from 'class-validator';

export class AiResponseDto {
  @Expose()
  @IsString()
  @ApiProperty({
    description: 'Assistant answer.',
    example: 'There are 100 employees in the company.',
  })
  public readonly response: string;
}
