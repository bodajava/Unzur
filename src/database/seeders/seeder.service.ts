import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogSeeder } from './catalog.seeder.js';
import { SuperAdminSeeder } from './super-admin.seeder.js';

/**
 * Runs seeders on startup only when their env flag is "true":
 *   SEED_CATALOG=true, SEED_SUPER_ADMIN=true
 * Or on demand: npm run seed
 */
@Injectable()
export class SeederService implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    private readonly catalog: CatalogSeeder,
    private readonly superAdmin: SuperAdminSeeder,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.flag('SEED_SUPER_ADMIN')) await this.superAdmin.run();
    if (this.flag('SEED_CATALOG')) await this.catalog.run();
  }

  async runAll(): Promise<void> {
    await this.superAdmin.run();
    await this.catalog.run();
  }

  private flag(name: string): boolean {
    return this.config.get<string>(name) === 'true';
  }
}
