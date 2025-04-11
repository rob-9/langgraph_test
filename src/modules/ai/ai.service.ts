import { Injectable } from '@nestjs/common';
import { AiQuestionDto } from './dto/question.dto'
import { AiResponseDto } from './dto/response.dto';

@Injectable()
export class AiService {
  question(question: AiQuestionDto): AiResponseDto {
    // return question asked.
    return {
      response: "I don't know yet."
    }
  }
}