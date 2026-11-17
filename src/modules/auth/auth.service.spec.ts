import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Lang, OtpType, UserRole } from '../../common/enums/index.js';
import { AppEvents } from '../../common/events/index.js';
import type { RequestMeta } from '../../common/interfaces/auth.interface.js';
import { AuthService } from './auth.service.js';

const meta: RequestMeta = { lang: Lang.EN };

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.com',
    phone: null,
    firstName: 'A',
    passwordHash: 'hash',
    role: UserRole.CUSTOMER,
    isActive: true,
    isEmailVerified: true,
    ...overrides,
  };
}

function setup(user: ReturnType<typeof makeUser> | null, passwordOk = true) {
  const users = {
    findByEmailWithPassword: vi.fn().mockResolvedValue(user),
    findProfile: vi.fn().mockResolvedValue(user),
  };
  const hash = { compare: vi.fn().mockResolvedValue(passwordOk) };
  const sessions = { issue: vi.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }) };
  const otp = { issue: vi.fn().mockResolvedValue('123456') };
  const carts = { mergeGuestCart: vi.fn().mockResolvedValue(0) };
  const orders = { claimGuestOrders: vi.fn().mockResolvedValue(0) };
  const events = { emit: vi.fn() };

  const service = new AuthService(
    users as never,
    {} as never,
    {} as never,
    {} as never,
    hash as never,
    {} as never,
    sessions as never,
    otp as never,
    carts as never,
    orders as never,
    events as never,
  );
  return { service, users, hash, sessions, otp, carts, orders, events };
}

describe('AuthService', () => {
  it('rejects unknown email and wrong password with the same 401', async () => {
    const unknown = setup(null, false);
    await expect(unknown.service.login({ email: 'x@y.com', password: 'p' }, {}, meta)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    // bcrypt still runs for unknown emails (timing)
    expect(unknown.hash.compare).toHaveBeenCalledWith('p', undefined);

    const wrong = setup(makeUser(), false);
    await expect(wrong.service.login({ email: 'a@b.com', password: 'p' }, {}, meta)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('blocks unverified users and emits an OTP email event', async () => {
    const { service, events, otp, sessions } = setup(makeUser({ isEmailVerified: false }));
    await expect(service.login({ email: 'a@b.com', password: 'p' }, {}, meta)).rejects.toThrow(
      new ForbiddenException('Please verify your email first'),
    );
    expect(otp.issue).toHaveBeenCalledWith('a@b.com', OtpType.EMAIL_VERIFICATION);
    expect(events.emit).toHaveBeenCalledWith(
      AppEvents.AUTH_OTP_REQUESTED,
      expect.objectContaining({ email: 'a@b.com', code: '123456' }),
    );
    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it('does not emit an email when the OTP send limit is reached', async () => {
    const { service, events, otp } = setup(makeUser({ isEmailVerified: false }));
    otp.issue.mockResolvedValue(null);
    await expect(service.login({ email: 'a@b.com', password: 'p' }, {}, meta)).rejects.toThrow(ForbiddenException);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('merges the guest cart and claims orders on login', async () => {
    const { service, carts, orders } = setup(makeUser());
    const result = await service.login({ email: 'a@b.com', password: 'p' }, { guestId: 'guest_abc12345' }, meta);
    expect(carts.mergeGuestCart).toHaveBeenCalledWith('guest_abc12345', 'u1');
    expect(orders.claimGuestOrders).toHaveBeenCalled();
    expect(result.accessToken).toBe('at');
  });

  it('admin login rejects customers and disabled accounts', async () => {
    await expect(setup(makeUser()).service.adminLogin({ email: 'a@b.com', password: 'p' }, meta)).rejects.toThrow(
      new ForbiddenException('Admin access only'),
    );
    await expect(
      setup(makeUser({ role: UserRole.ADMIN, isActive: false })).service.adminLogin(
        { email: 'a@b.com', password: 'p' },
        meta,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      setup(makeUser({ role: UserRole.STAFF })).service.adminLogin({ email: 'a@b.com', password: 'p' }, meta),
    ).resolves.toMatchObject({ accessToken: 'at' });
  });
});
