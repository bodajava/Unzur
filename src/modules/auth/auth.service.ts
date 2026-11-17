import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ADMIN_ROLES, Lang, OtpType, UserRole } from '../../common/enums/index.js';
import {
  AppEvents,
  OtpRequestedEvent,
  StaffCreatedEvent,
  UserEmailVerifiedEvent,
  UserRegisteredEvent,
} from '../../common/events/index.js';
import type { Actor, RequestMeta } from '../../common/interfaces/auth.interface.js';
import { HashService } from '../../common/services/security/hash.service.js';
import { RandomService } from '../../common/services/security/random.service.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { ReferralRepository } from '../../models/repositories/referral.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import type { UserProfile } from '../../models/schemas/user.schema.js';
import { CartService } from '../cart/cart.service.js';
import { OrderClaimsService } from '../orders/order-claims.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { normalizePhone } from '../../common/utilities/phone.js';
import type {
  ChangePasswordDto,
  UpdateProfileDto,
  CreateStaffDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/index.js';
import type { AuthResult, AuthTokens, RegisterResult } from './entities/auth.entity.js';
import { OtpService } from './otp.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly referrals: ReferralRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly hash: HashService,
    private readonly random: RandomService,
    private readonly sessions: AuthSessionService,
    private readonly otp: OtpService,
    private readonly carts: CartService,
    private readonly orders: OrderClaimsService,
    private readonly events: EventEmitter2,
  ) {}

  // ───────────────────────── 1.1 Register ─────────────────────────

  async register(dto: RegisterDto, actor: Actor, meta: RequestMeta): Promise<RegisterResult> {
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const referralCodeUsed = dto.referralCode?.toUpperCase();
    let referrerId: string | undefined;
    if (referralCodeUsed) {
      const referrer = await this.users.findByReferralCode(referralCodeUsed);
      if (!referrer?.isActive) throw new BadRequestException('Invalid referral code');
      referrerId = referrer.id;
    }

    const passwordHash = await this.hash.hash(dto.password);
    const referralCode = await this.generateReferralCode();

    const user = await this.tx.run(async (tx) => {
      const created = await this.users.withTx(tx).createWithProfile({
        email: dto.email,
        phone: dto.phone ? normalizePhone(dto.phone) : undefined,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.CUSTOMER,
        isEmailVerified: false,
        referralCode,
        referredById: referrerId,
      });
      if (referrerId && referralCodeUsed) {
        await this.referrals.withTx(tx).create({
          referrerId,
          referredUserId: created.id,
          codeUsed: referralCodeUsed,
        });
      }
      return created;
    });

    if (actor.guestId) await this.carts.mergeGuestCart(actor.guestId, user.id);

    await this.requestOtp(user, OtpType.EMAIL_VERIFICATION, meta.lang);
    this.events.emit(
      AppEvents.USER_REGISTERED,
      new UserRegisteredEvent(user.id, user.email, referrerId),
    );

    return { user, requiresEmailVerification: true };
  }

  // ───────────────────────── 1.2 Verify OTP ─────────────────────────

  async verifyEmail(
    dto: VerifyOtpDto,
    actor: Actor,
    meta: RequestMeta,
  ): Promise<AuthResult & { claimedOrders: number }> {
    const user = await this.users.findByEmail(dto.email);
    // Same error as a wrong code: do not reveal whether the email exists.
    if (!user?.isActive) throw new BadRequestException('Invalid or expired code');
    if (user.isEmailVerified) throw new BadRequestException('Email is already verified');

    await this.otp.verifyAndConsume(dto.email, OtpType.EMAIL_VERIFICATION, dto.code);

    const claimedOrders = await this.tx.run(async (tx) => {
      await this.users.withTx(tx).updateById(user.id, { isEmailVerified: true });
      return this.orders.claimGuestOrders(user, actor.guestId, tx);
    });

    if (actor.guestId) await this.carts.mergeGuestCart(actor.guestId, user.id);

    this.events.emit(
      AppEvents.USER_EMAIL_VERIFIED,
      new UserEmailVerifiedEvent(user.id, claimedOrders),
    );
    return { ...(await this.buildAuthResult(user.id, meta)), claimedOrders };
  }

  // ───────────────────────── 1.3 / 1.11 Login ─────────────────────────

  async login(dto: LoginDto, actor: Actor, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.validateCredentials(dto);

    if (!user.isEmailVerified) {
      await this.requestOtp(user, OtpType.EMAIL_VERIFICATION, meta.lang);
      throw new ForbiddenException('Please verify your email first');
    }

    if (actor.guestId) await this.carts.mergeGuestCart(actor.guestId, user.id);
    await this.orders.claimGuestOrders(user, actor.guestId);

    return this.buildAuthResult(user.id, meta);
  }

  async adminLogin(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.validateCredentials(dto);
    if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenException('Admin access only');
    return this.buildAuthResult(user.id, meta);
  }

  // ───────────────────────── 1.4 Refresh ─────────────────────────

  refresh(refreshToken: string | undefined, meta: RequestMeta): Promise<AuthTokens> {
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');
    return this.sessions.rotate(refreshToken, meta);
  }

  // ───────────────────────── 1.5 / 1.6 Password reset ─────────────────────────

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (!user?.isActive) return; // no account enumeration
    await this.requestOtp(user, OtpType.PASSWORD_RESET, meta.lang);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (!user?.isActive) throw new BadRequestException('Invalid or expired code');

    await this.otp.verifyAndConsume(dto.email, OtpType.PASSWORD_RESET, dto.code);

    const passwordHash = await this.hash.hash(dto.newPassword);
    // Receiving the code proves ownership of the email.
    await this.users.updateById(user.id, { passwordHash, isEmailVerified: true });
    await this.sessions.revokeAll(user.id);
  }

  // ───────────────────────── 1.7 Logout / 1.8 Me ─────────────────────────

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) await this.sessions.revoke(refreshToken, userId);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findProfile(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ───────────────────────── 10.1 / 10.2 Profile ─────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const phone = dto.phone === undefined ? undefined : dto.phone === null ? null : normalizePhone(dto.phone);
    if (phone && (await this.users.phoneTakenByOther(phone, userId))) {
      throw new ConflictException('This phone number is used by another account');
    }
    // A race on the same phone still ends as 409 via the unique index (P2002).
    return this.users.updateProfile(userId, { firstName: dto.firstName, lastName: dto.lastName, phone });
  }

  /**
   * Checks the current password, saves the new one and signs out every
   * session (all refresh tokens revoked). This device gets fresh tokens.
   */
  async changePassword(userId: string, dto: ChangePasswordDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user || !(await this.hash.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('The new password must be different');
    }
    const passwordHash = await this.hash.hash(dto.newPassword);
    await this.users.updateById(userId, { passwordHash });
    await this.sessions.revokeAll(userId);
    return this.buildAuthResult(userId, meta);
  }

  // ───────────────────────── 1.12 Create staff ─────────────────────────

  async createStaff(dto: CreateStaffDto, actorId: string, meta: RequestMeta): Promise<UserProfile> {
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hash.hash(dto.password);
    const referralCode = await this.generateReferralCode();

    const staff = await this.tx.run(async (tx) => {
      const created = await this.users.withTx(tx).createWithProfile({
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        isEmailVerified: true,
        referralCode,
      });
      await this.auditLogs.withTx(tx).create({
        actorId,
        action: 'STAFF_CREATED',
        entityType: 'User',
        entityId: created.id,
        newValues: { email: created.email, role: created.role },
        ipAddress: meta.ipAddress,
      });
      return created;
    });

    this.events.emit(AppEvents.STAFF_CREATED, new StaffCreatedEvent(staff.id, actorId));
    return staff;
  }

  // ───────────────────────── Internals ─────────────────────────

  private async validateCredentials(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    // Always run bcrypt (dummy hash when missing) so timing does not leak existence.
    const ok = await this.hash.compare(dto.password, user?.passwordHash);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new ForbiddenException('This account has been disabled');
    return user;
  }

  private async buildAuthResult(userId: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.getProfile(userId);
    return { user, ...(await this.sessions.issue(user, meta)) };
  }

  /** Creates the code now; the email is sent by AuthListener in the background. */
  private async requestOtp(
    user: { email: string; firstName: string },
    type: OtpType,
    lang: Lang,
  ): Promise<boolean> {
    const code = await this.otp.issue(user.email, type);
    if (!code) return false; // rate limited: silently skip
    this.events.emit(
      AppEvents.AUTH_OTP_REQUESTED,
      new OtpRequestedEvent(user.email, user.firstName, type, code, lang),
    );
    return true;
  }

  private async generateReferralCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = this.random.referralCode();
      if (!(await this.users.referralCodeExists(code))) return code;
    }
    throw new Error('Could not generate a unique referral code');
  }
}
