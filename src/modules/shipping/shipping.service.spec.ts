import { NotFoundException } from '@nestjs/common';
import { settingValueError } from '../settings/setting-rules.js';
import { ShippingService } from './shipping.service.js';

function setup(threshold: number | null) {
  const zones = {
    findActiveByGovernorate: vi.fn().mockResolvedValue({ governorate: 'Cairo', nameAr: 'القاهرة', fee: 5000, estimatedDays: '2-3' }),
  };
  const settings = { freeShippingThreshold: vi.fn().mockResolvedValue(threshold) };
  return { service: new ShippingService(zones as never, settings as never, {} as never, {} as never), zones };
}

describe('ShippingService.rate', () => {
  it('is free at or above the threshold', async () => {
    const { service, zones } = setup(100_000);
    await expect(service.rate('  cairo ', 100_000)).resolves.toMatchObject({ fee: 0, originalFee: 5000, isFreeShipping: true });
    expect(zones.findActiveByGovernorate).toHaveBeenCalledWith('cairo');
    await expect(service.rate('Cairo', 99_999)).resolves.toMatchObject({ fee: 5000, amountToFreeShipping: 1 });
  });

  it('charges the fee when no threshold or subtotal is known', async () => {
    await expect(setup(null).service.rate('Cairo', 1_000_000)).resolves.toMatchObject({ fee: 5000, isFreeShipping: false });
    await expect(setup(100).service.rate('Cairo')).resolves.toMatchObject({ isFreeShipping: false, amountToFreeShipping: null });
  });

  it('404s for an unknown governorate', async () => {
    const { service, zones } = setup(null);
    zones.findActiveByGovernorate.mockResolvedValue(null);
    await expect(service.rate('Atlantis')).rejects.toThrow(NotFoundException);
  });
});

describe('settingValueError', () => {
  it('type-checks known keys and accepts any JSON for others', () => {
    expect(settingValueError('free_shipping_threshold', 50_000)).toBeNull();
    expect(settingValueError('free_shipping_threshold', null)).toBeNull();
    expect(settingValueError('free_shipping_threshold', 10.5)).toMatch(/piasters/);
    expect(settingValueError('currency', 'egp')).toMatch(/3-letter/);
    expect(settingValueError('banner', { text: 'Hi' })).toBeNull();
    expect(settingValueError('banner', undefined)).toBe('value is required');
  });
});
