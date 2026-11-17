import { Readable } from 'node:stream';

export type CsvValue = string | number | boolean | Date | null | undefined;

/** Excel treats cells starting with these as formulas (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell. Text is always quoted ("" escapes quotes) and gets a leading
 * apostrophe when it starts with = + - @ tab or CR, so Excel shows it as text.
 * Numbers stay numbers.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = value instanceof Date ? value.toISOString() : value;
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const csvRow = (values: CsvValue[]): string => `${values.map(csvCell).join(',')}\r\n`;

/** UTF-8 CSV stream with BOM (Arabic shows correctly in Excel). Rows are pulled lazily. */
export function csvStream(header: string[], rows: AsyncIterable<CsvValue[]>): Readable {
  async function* generate() {
    yield `﻿${header.map((h) => csvCell(h)).join(',')}\r\n`;
    for await (const row of rows) yield csvRow(row);
  }
  return Readable.from(generate());
}
