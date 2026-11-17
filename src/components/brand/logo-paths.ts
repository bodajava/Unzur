/*
 * The UNZUR mark, traced 1:1 from the shape layers of the brand PSD
 * (logo.psd, 1500×1500 artboard, offset by 318,590 so the mark starts at 0,0).
 * The eye sits on the shortened right stem of the N, like the dot of an "i".
 */
export const LOGO_BOX = { width: 942, height: 357 } as const;
/** Centre of the pupil, in the logo's own units. */
export const PUPIL = { x: 350, y: 35 } as const;

export const LETTERS = [
  // U
  "M2.18 292.31C2.18 314.47 11.1 330.52 28.95 340.46C46.79 350.4 67.85 355.37 92.13 355.37C118.36 355.37 139.87 349.83 156.65 338.75C173.44 327.67 181.83 312.02 181.83 291.82L181.83 1.69L104.84 1.69L104.84 295.97C104.84 302.98 100.6 306.48 92.13 306.48C83.49 306.48 79.17 302.98 79.17 295.97L79.17 1.69L2.18 1.69Z",
  // N (right stem cut short under the eye)
  "M384.22 78.08L319.94 78.08L319.94 161.54L275.94 1.69L188.44 1.69L188.44 352.19L252.72 352.19L252.72 165.45L305.03 352.19L384.22 352.19Z",
  // Z
  "M561.19 307.22L470.86 307.22L555.32 47.89L555.32 1.69L392.54 1.69L392.54 47.4L472.45 47.4L387.41 307.7L387.41 352.19L561.19 352.19Z",
  // U
  "M564.38 292.31C564.38 314.47 573.3 330.52 591.14 340.46C608.98 350.4 630.04 355.37 654.32 355.37C680.56 355.37 702.06 349.83 718.85 338.75C735.63 327.67 744.02 312.02 744.02 291.82L744.02 1.69L667.03 1.69L667.03 295.97C667.03 302.98 662.79 306.48 654.32 306.48C645.68 306.48 641.37 302.98 641.37 295.97L641.37 1.69L564.38 1.69Z",
  // R (with its counter)
  "M926.37 257.35L927.59 218.98C927.59 187.86 911.62 168.55 879.69 161.05C911.46 151.44 927.35 133.03 927.35 105.81L927.35 63.77C927.35 42.26 919.32 26.54 903.27 16.6C887.22 6.66 868.36 1.69 846.69 1.69L751.61 1.69L751.61 352.19L828.6 352.19L828.6 184.03C844.57 184.03 852.56 189.98 852.56 201.87C852.56 202.52 852.31 217.43 851.82 246.6L851.33 267.62L851.33 268.11C851.33 314.55 855.49 342.74 863.8 352.68L940.79 352.68C931.18 345.18 926.37 313.41 926.37 257.35ZM828.6 141.5L828.6 46.66C844.41 46.66 852.31 52.79 852.31 65.04L852.31 122.87C852.31 135.29 844.41 141.5 828.6 141.5Z",
];

export const BALL = "M350 2C368.78 2 384 17 384 35.5C384 54 368.78 69 350 69C331.22 69 316 54 316 35.5C316 17 331.22 2 350 2Z";
export const OPENING =
  "M350 15.21C361.37 15.21 395 24.17 395 35.5C395 46.83 361.37 55.79 350 55.79C338.63 55.79 307 46.83 307 35.5C307 24.17 338.63 15.21 350 15.21Z";

/** The mark as a standalone SVG string (share cards, generated icons). */
export function logoSvg(color: string): string {
  const eye = `<mask id="o" maskUnits="userSpaceOnUse" x="300" y="0" width="100" height="72"><rect x="300" width="100" height="72" fill="#fff"/><path d="${OPENING}" fill="#000"/></mask><path mask="url(#o)" d="${BALL}"/><circle cx="${PUPIL.x}" cy="${PUPIL.y}" r="12"/>`;
  const letters = LETTERS.map((d) => `<path fill-rule="evenodd" d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_BOX.width} ${LOGO_BOX.height}" fill="${color}">${letters}${eye}</svg>`;
}
