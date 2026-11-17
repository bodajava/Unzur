import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

/** Database-level checks (health). */
@Injectable()
export class SystemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<boolean> {
    await this.prisma.$queryRaw`SELECT 1`;
    return true;
  }
}
