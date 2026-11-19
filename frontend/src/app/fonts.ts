import { Amiri } from "next/font/google";
import localFont from "next/font/local";

/** Archivo variable (weight 100–900, width 62–125), Latin subset. Body + wordmark. */
export const archivo = localFont({
  src: "./fonts/archivo-latin-var.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

/** Special Gothic Expanded One, Latin subset. Headings and product names. */
export const gothic = localFont({
  src: "./fonts/special-gothic-expanded-one-latin.woff2",
  variable: "--font-gothic",
  weight: "400",
  display: "swap",
});

/**
 * Arabic text: Amiri, a classic naskh that carries tashkeel (vowel marks)
 * cleanly. The brand fonts have no Arabic letters.
 */
export const arabic = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});
