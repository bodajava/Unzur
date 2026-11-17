const egp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Piasters -> "2,999 EGP" */
export function formatPrice(piasters: number): string {
  return `${egp.format(piasters / 100)} EGP`;
}
