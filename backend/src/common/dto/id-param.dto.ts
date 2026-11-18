import { IsUUID } from 'class-validator';

/** Route params like /:id */
export class IdParamDto {
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id: string;
}
