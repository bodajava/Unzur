import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

/** Validates a UUID route param: @Param('id', ParseIdPipe) id: string */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUUID(value)) throw new BadRequestException('Invalid id');
    return value;
  }
}
