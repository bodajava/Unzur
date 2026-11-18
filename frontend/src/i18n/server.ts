import { notFound } from "next/navigation";
import { lang as langParam } from "next/root-params";
import { isLocale, type Locale } from "./config";
import { ar } from "./dictionaries/ar";
import { en, type Dictionary } from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { en, ar };

/** The page's language (the /en or /ar root segment). 404 for anything else. */
export async function getLang(): Promise<Locale> {
  const value = await langParam();
  if (!isLocale(value)) notFound();
  return value;
}

/** Copy for the current page's language (server components). */
export async function getDictionary(lang?: Locale): Promise<Dictionary> {
  return dictionaries[lang ?? (await getLang())];
}

export function dictionaryFor(lang: Locale): Dictionary {
  return dictionaries[lang];
}
