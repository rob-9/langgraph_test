import { Controller, Post, Delete, Get, Body, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiQuestionDto } from './dto/question.dto'
import { AiResponseDto } from './dto/response.dto';

@Controller('/api/v1/assistant')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('question')
  question(@Body() question: AiQuestionDto ): AiResponseDto {
    return this.aiService.question(question);
  }
}
