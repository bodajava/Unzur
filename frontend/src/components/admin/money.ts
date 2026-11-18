/** Dashboard money inputs are in EGP; the API stores piasters. */
export const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

export const toEgp = (piasters: number | null | undefined) =>
  piasters === null || piasters === undefined ? "" : (piasters / 100).toFixed(piasters % 100 ? 2 : 0);

export const toPiasters = (egp: string) => Math.round(Number.parseFloat(egp) * 100);
