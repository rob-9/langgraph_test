
import { ApiProperty, } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString } from 'class-validator';

export class AiQuestionDto {
  @Expose()
  @ApiProperty({
    type: [Object],
    isArray: true,
    description: "All past messages in this conversation.",
    example: [
      {"question": "How many employees?", "answer": "There are 100 employees."},
      { "question": "How many departments?", "answer": "There are 14 departments."}
    ]
  })
  public readonly conversation: Record<string, any>[];

  @Expose()
  @IsString()
  @ApiProperty({
    description: 'User question',
    example: 'How many people are employed in the company?',
  })
  public readonly question: string;
}
