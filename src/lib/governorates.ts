/**
 * Egypt's 27 governorates. `value` is what the API stores on shipping zones;
 * the API also accepts the Arabic name.
 */
export const GOVERNORATES = [
  { value: "Cairo", ar: "القاهرة" },
  { value: "Giza", ar: "الجيزة" },
  { value: "Qalyubia", ar: "القليوبية" },
  { value: "Alexandria", ar: "الإسكندرية" },
  { value: "Beheira", ar: "البحيرة" },
  { value: "Dakahlia", ar: "الدقهلية" },
  { value: "Damietta", ar: "دمياط" },
  { value: "Gharbia", ar: "الغربية" },
  { value: "Kafr El Sheikh", ar: "كفر الشيخ" },
  { value: "Monufia", ar: "المنوفية" },
  { value: "Sharqia", ar: "الشرقية" },
  { value: "Ismailia", ar: "الإسماعيلية" },
  { value: "Port Said", ar: "بورسعيد" },
  { value: "Suez", ar: "السويس" },
  { value: "Faiyum", ar: "الفيوم" },
  { value: "Beni Suef", ar: "بني سويف" },
  { value: "Minya", ar: "المنيا" },
  { value: "Asyut", ar: "أسيوط" },
  { value: "Sohag", ar: "سوهاج" },
  { value: "Qena", ar: "قنا" },
  { value: "Luxor", ar: "الأقصر" },
  { value: "Aswan", ar: "أسوان" },
  { value: "Red Sea", ar: "البحر الأحمر" },
  { value: "Matrouh", ar: "مطروح" },
  { value: "New Valley", ar: "الوادي الجديد" },
  { value: "North Sinai", ar: "شمال سيناء" },
  { value: "South Sinai", ar: "جنوب سيناء" },
] as const;

export function governorateLabel(value: string, lang: "en" | "ar"): string {
  const g = GOVERNORATES.find((x) => x.value.toLowerCase() === value.toLowerCase() || x.ar === value);
  return g ? (lang === "ar" ? g.ar : g.value) : value;
}
