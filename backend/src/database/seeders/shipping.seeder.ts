import { Injectable, Logger } from '@nestjs/common';
import { ShippingZoneRepository } from '../../models/repositories/shipping-zone.repository.js';
import { SHIPPING_SEED } from './shipping.data.js';

/** Insert-only: governorates that already have a zone are left untouched. */
@Injectable()
export class ShippingZoneSeeder {
  private readonly logger = new Logger(ShippingZoneSeeder.name);

  constructor(private readonly zones: ShippingZoneRepository) {}

  async run(): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    for (const z of SHIPPING_SEED) {
      if (await this.zones.exists({ governorate: z.governorate })) {
        skipped++;
        continue;
      }
      await this.zones.create({ ...z });
      inserted++;
    }
    this.logger.log(`Shipping zones seed: ${inserted} inserted, ${skipped} already present`);
    return { inserted, skipped };
  }
}
