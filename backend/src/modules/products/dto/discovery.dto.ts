import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/decorators/index.js';

/** GET /search/suggest?q= */
export class SuggestQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** POST /products/:id/notify-me */
export class NotifyMeDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsUUID('4')
  variantId?: string;
}
