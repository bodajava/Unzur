/**
 * SAMPLE delivery zones for local development: all 27 governorates with
 * placeholder fees (piasters) and delivery times. The store owner sets the
 * real values in the dashboard (admin/shipping-zones). Insert-only.
 */
const zone = (governorate: string, nameAr: string, fee: number, estimatedDays: string) => ({
  governorate,
  nameAr,
  fee,
  estimatedDays,
});

export const SHIPPING_SEED = [
  // Greater Cairo
  zone('Cairo', 'القاهرة', 6000, '1-2'),
  zone('Giza', 'الجيزة', 6000, '1-2'),
  zone('Qalyubia', 'القليوبية', 7000, '2-3'),
  // Alexandria & Delta
  zone('Alexandria', 'الإسكندرية', 7500, '2-3'),
  zone('Beheira', 'البحيرة', 8500, '2-4'),
  zone('Dakahlia', 'الدقهلية', 8500, '2-4'),
  zone('Damietta', 'دمياط', 8500, '2-4'),
  zone('Gharbia', 'الغربية', 8500, '2-4'),
  zone('Kafr El Sheikh', 'كفر الشيخ', 8500, '2-4'),
  zone('Monufia', 'المنوفية', 8500, '2-4'),
  zone('Sharqia', 'الشرقية', 8500, '2-4'),
  // Canal
  zone('Ismailia', 'الإسماعيلية', 8500, '2-4'),
  zone('Port Said', 'بورسعيد', 8500, '2-4'),
  zone('Suez', 'السويس', 8500, '2-4'),
  // Upper Egypt
  zone('Faiyum', 'الفيوم', 9500, '3-5'),
  zone('Beni Suef', 'بني سويف', 9500, '3-5'),
  zone('Minya', 'المنيا', 10500, '3-5'),
  zone('Asyut', 'أسيوط', 11000, '3-5'),
  zone('Sohag', 'سوهاج', 11000, '3-5'),
  zone('Qena', 'قنا', 11500, '4-6'),
  zone('Luxor', 'الأقصر', 11500, '4-6'),
  zone('Aswan', 'أسوان', 12000, '4-6'),
  // Frontier
  zone('Red Sea', 'البحر الأحمر', 13000, '4-6'),
  zone('Matrouh', 'مطروح', 13000, '4-6'),
  zone('New Valley', 'الوادي الجديد', 14000, '5-7'),
  zone('North Sinai', 'شمال سيناء', 14000, '5-7'),
  zone('South Sinai', 'جنوب سيناء', 13000, '4-6'),
] as const;
