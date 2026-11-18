import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentActor, Public, RateLimit } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { NotificationService } from '../../common/services/notification/notification.service.js';
import { PushDeviceRepository } from '../../models/repositories/push-device.repository.js';
import { RegisterDeviceDto, RemoveDeviceDto } from './dto/index.js';

const STAFF: (UserRole | undefined)[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF];

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly devices: PushDeviceRepository,
    private readonly push: NotificationService,
  ) {}

  /**
   * Saves this browser's push token for the signed-in person or the guest
   * session. Staff get store alerts only when they ask for them (audience=staff).
   */
  @Public()
  @RateLimit({ limit: 30, windowSeconds: 3600 })
  @Post('devices')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: RegisterDeviceDto, @CurrentActor() actor: Actor) {
    if (!actor.userId && !actor.guestId) throw new BadRequestException('Sign in or start a session first');
    const isStaff = dto.audience === 'staff' && STAFF.includes(actor.role);
    if (dto.audience === 'staff' && !isStaff) throw new BadRequestException('Store alerts are for staff accounts');
    await this.devices.register({
      token: dto.token,
      userId: actor.userId ?? null,
      guestId: actor.userId ? null : (actor.guestId ?? null),
      isStaff,
      lang: dto.lang ?? 'ar',
    });
    return { registered: true, isStaff, pushEnabled: this.push.isPushEnabled };
  }

  /** Stops notifications to this browser. */
  @Public()
  @RateLimit({ limit: 30, windowSeconds: 3600 })
  @Delete('devices')
  @HttpCode(HttpStatus.OK)
  async remove(@Body() dto: RemoveDeviceDto) {
    await this.devices.removeTokens([dto.token]);
    return { removed: true };
  }
}
