import { Module } from '@nestjs/common';
import { CatalogSeeder } from './catalog.seeder.js';
import { SeederService } from './seeder.service.js';
import { SuperAdminSeeder } from './super-admin.seeder.js';

@Module({
  providers: [SeederService, CatalogSeeder, SuperAdminSeeder],
  exports: [SeederService],
})
export class SeedersModule {}
