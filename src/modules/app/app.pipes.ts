import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllExceptionsFilter } from 'zyprova-common-lib/dist/http';
import { ValidationException } from 'zyprova-common-lib/dist/http';
import { RequestHandlerInterceptor, requestHandlerMiddleware } from 'zyprova-common-lib/dist/http';

import { flatten } from '~utils/validation';

export function globalPipes(app: INestApplication): void {
  app.use(requestHandlerMiddleware);
  app.useGlobalInterceptors(new RequestHandlerInterceptor());

  // send exceptions as formatted error messages
  app.useGlobalFilters(new AllExceptionsFilter());

  // serialize all class-validated dto's
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector), { excludeExtraneousValues: true }));

  // validate request DTO with class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // use DTOs as runtime types
      whitelist: true, // strip non-whitelisted
      // forbidNonWhitelisted: true, // throw on non-whitelisted
      exceptionFactory: (fieldErrors) => {
        return new ValidationException(flatten(fieldErrors));
      },
    }),
  );
}
