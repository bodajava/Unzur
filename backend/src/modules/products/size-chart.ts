/** Size chart data (products.size_chart) and how it is read; no Nest code, so anyone can import it. */

export const DEFAULT_SIZE_CHART_TITLE = 'Size chart';

export interface SizeChartOption {
  label: string;
  url: string;
}

/** Stored in products.size_chart. Turning it off keeps the photos for later. */
export interface SizeChart {
  enabled: boolean;
  title: string;
  options: SizeChartOption[];
}

/** What the product page gets: only a chart that is on and has a photo. */
export type PublicSizeChart = Pick<SizeChart, 'title' | 'options'>;

/** Reads the stored JSON defensively (anything malformed counts as no chart). */
export function readSizeChart(value: unknown): SizeChart | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<SizeChart>;
  const options = Array.isArray(v.options)
    ? v.options.filter((o): o is SizeChartOption => typeof o?.label === 'string' && typeof o?.url === 'string')
    : [];
  return { enabled: v.enabled === true, title: typeof v.title === 'string' && v.title ? v.title : DEFAULT_SIZE_CHART_TITLE, options };
}

export function publicSizeChart(value: unknown): PublicSizeChart | null {
  const chart = readSizeChart(value);
  return chart?.enabled && chart.options.length ? { title: chart.title, options: chart.options } : null;
}
