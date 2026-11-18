import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../common/enums/index.js';
import { HashService } from '../../common/services/security/hash.service.js';
import { RandomService } from '../../common/services/security/random.service.js';
import { UserRepository } from '../../models/repositories/user.repository.js';

/** Insert-only: creates the first SUPER_ADMIN if that email does not exist yet. */
@Injectable()
export class SuperAdminSeeder {
  private readonly logger = new Logger(SuperAdminSeeder.name);

  constructor(
    private readonly users: UserRepository,
    private readonly hash: HashService,
    private readonly random: RandomService,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<boolean> {
    const email = this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');
    if (!email || !password || password.length < 12) {
      this.logger.warn('Skipped: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (min 12 chars)');
      return false;
    }
    if (await this.users.emailExists(email)) {
      this.logger.log(`Skipped: ${email} already exists`);
      return false;
    }
    await this.users.create({
      email,
      passwordHash: await this.hash.hash(password),
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      referralCode: this.random.referralCode(),
    });
    this.logger.log(`SUPER_ADMIN created: ${email}`);
    return true;
  }
}
