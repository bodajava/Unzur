import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** A browser's FCM token. `audience: 'staff'` asks for store alerts (staff accounts only). */
export class RegisterDeviceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en';

  @IsOptional()
  @IsIn(['staff', 'customer'])
  audience?: 'staff' | 'customer';
}

export class RemoveDeviceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;
}
