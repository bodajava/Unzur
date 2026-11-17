import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import {
  CurrentActor,
  CurrentUser,
  Public,
  RateLimit,
  ResponseMessage,
  Roles,
} from '../../common/decorators/index.js';
import { CookieName, UserRole } from '../../common/enums/index.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import type { AppRequest } from '../../common/interfaces/request.interface.js';
import { requestMeta } from '../../common/utilities/request-meta.js';
import { CheckoutService } from '../orders/checkout.service.js';
import { CheckoutDto } from '../orders/dto/index.js';
import { CHECKOUT_LIMIT } from '../orders/orders.controller.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  UpdateProfileDto,
  CreateStaffDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/index.js';
import type { AuthTokens } from './entities/auth.entity.js';
import {
  GUEST_SESSION_TTL_SEC,
  GuestSessionService,
} from '../../common/services/guest/guest-session.service.js';

const REFRESH_COOKIE_PATH = '/api/v1/auth';
const FIFTEEN_MIN = 15 * 60;
const byIpAndEmail = (req: AppRequest) => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return `${req.ip}:${typeof email === 'string' ? email.trim().toLowerCase() : ''}`;
};

@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly guests: GuestSessionService,
    private readonly checkout: CheckoutService,
    config: ConfigService,
  ) {
    this.secureCookies = config.get<string>('NODE_ENV') === 'production';
  }

  /** 1.1 */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post('register')
  @ResponseMessage('Account created. Check your email for the verification code.')
  register(@Body() dto: RegisterDto, @CurrentActor() actor: Actor, @Req() req: AppRequest) {
    return this.auth.register(dto, actor, requestMeta(req));
  }

  /** 1.2 */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: FIFTEEN_MIN })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email verified')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentActor() actor: Actor,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyEmail(dto, actor, requestMeta(req));
    this.setRefreshCookie(res, result);
    return result;
  }

  /** 1.3 */
  @Public()
  @RateLimit({ limit: 5, windowSeconds: FIFTEEN_MIN, by: byIpAndEmail })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @CurrentActor() actor: Actor,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, actor, requestMeta(req));
    this.setRefreshCookie(res, result);
    return result;
  }

  /** 1.4 */
  @Public()
  @RateLimit({ limit: 30, windowSeconds: 60 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = dto.refreshToken ?? this.cookie(req, CookieName.REFRESH_TOKEN);
    try {
      const tokens = await this.auth.refresh(token, requestMeta(req));
      this.setRefreshCookie(res, tokens);
      return tokens;
    } catch (error) {
      this.clearRefreshCookie(res);
      throw error;
    }
  }

  /** 1.5 */
  @Public()
  @RateLimit({ limit: 5, windowSeconds: FIFTEEN_MIN })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If an account exists for this email, a reset code has been sent.')
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: AppRequest) {
    await this.auth.forgotPassword(dto, requestMeta(req));
    return {};
  }

  /** 1.6 */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: FIFTEEN_MIN })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated. Please log in again.')
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    await this.auth.resetPassword(dto);
    this.clearRefreshCookie(res);
    return {};
  }

  /** 1.7 */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out')
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser('id') userId: string,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(userId, dto.refreshToken ?? this.cookie(req, CookieName.REFRESH_TOKEN));
    this.clearRefreshCookie(res);
    res.clearCookie(CookieName.GUEST_ID, this.guestCookieOptions());
    return {};
  }

  /** 1.8 */
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.getProfile(userId);
  }

  /** 10.1 */
  @Patch('me')
  @ResponseMessage('Profile updated')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  /** 10.2 Signs out all other sessions; returns fresh tokens for this one. */
  @RateLimit({ limit: 5, windowSeconds: FIFTEEN_MIN })
  @Patch('change-password')
  @ResponseMessage('Password changed. Other sessions were signed out.')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(userId, dto, requestMeta(req));
    this.setRefreshCookie(res, result);
    return result;
  }

  /** 1.9 */
  @Public()
  @RateLimit({ limit: 30, windowSeconds: 60 })
  @Post('guest/session')
  @HttpCode(HttpStatus.OK)
  async guestSession(@CurrentActor() actor: Actor, @Res({ passthrough: true }) res: Response) {
    const session = await this.guests.ensure(actor.guestId);
    res.cookie(CookieName.GUEST_ID, session.guestId, {
      ...this.guestCookieOptions(),
      maxAge: GUEST_SESSION_TTL_SEC * 1000,
    });
    return session;
  }

  /** 1.10 Same as POST /orders/checkout (guest cart via x-guest-id / guest_id cookie). */
  @Public()
  @RateLimit(CHECKOUT_LIMIT)
  @Post('guest/checkout')
  @ResponseMessage('Order placed')
  guestCheckout(@Body() dto: CheckoutDto, @CurrentActor() actor: Actor) {
    return this.checkout.checkout(dto, actor);
  }

  /** 1.11 */
  @Public()
  @RateLimit({ limit: 5, windowSeconds: FIFTEEN_MIN, by: byIpAndEmail })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.adminLogin(dto, requestMeta(req));
    this.setRefreshCookie(res, result);
    return result;
  }

  /** 1.12 */
  @Roles(UserRole.SUPER_ADMIN)
  @Post('admin/staff')
  @ResponseMessage('Staff account created')
  createStaff(
    @Body() dto: CreateStaffDto,
    @CurrentUser('id') actorId: string,
    @Req() req: AppRequest,
  ) {
    return this.auth.createStaff(dto, actorId, requestMeta(req));
  }

  // ───────────────────────── cookie helpers ─────────────────────────

  private cookie(req: AppRequest, name: string): string | undefined {
    const value = req.cookies?.[name];
    return typeof value === 'string' && value ? value : undefined;
  }

  private refreshCookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secureCookies, sameSite: 'lax', path: REFRESH_COOKIE_PATH };
  }

  private guestCookieOptions(): CookieOptions {
    return this.guests.cookieOptions();
  }

  private setRefreshCookie(res: Response, tokens: Pick<AuthTokens, 'refreshToken' | 'refreshTokenExpiresAt'>) {
    res.cookie(CookieName.REFRESH_TOKEN, tokens.refreshToken, {
      ...this.refreshCookieOptions(),
      expires: new Date(tokens.refreshTokenExpiresAt),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(CookieName.REFRESH_TOKEN, this.refreshCookieOptions());
  }
}
