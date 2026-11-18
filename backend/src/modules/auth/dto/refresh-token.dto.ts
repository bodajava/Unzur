import { IsJWT, IsOptional } from 'class-validator';

/** refreshToken may also come from the refresh_token HttpOnly cookie. */
export class RefreshTokenDto {
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}
