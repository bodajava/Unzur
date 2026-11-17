import { Module } from '@nestjs/common';
import { CatalogSeeder } from './catalog.seeder.js';
import { SeederService } from './seeder.service.js';
import { ShippingZoneSeeder } from './shipping.seeder.js';
import { SuperAdminSeeder } from './super-admin.seeder.js';

@Module({
  providers: [SeederService, CatalogSeeder, ShippingZoneSeeder, SuperAdminSeeder],
  exports: [SeederService],
})
export class SeedersModule {}
