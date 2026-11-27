/**
 * Runs before the e2e suites: they create and delete rows and use Redis
 * counters, so they must never touch the live store's database by accident
 * (a copied .env is enough). Only local databases are allowed unless
 * E2E_ALLOW_REMOTE_DB=true is set on purpose.
 */
import 'dotenv/config';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'host.docker.internal']);

export default function guardLocalDatabase(): void {
  if (process.env.E2E_ALLOW_REMOTE_DB === 'true') return;
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('e2e: DATABASE_URL is missing or invalid.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `e2e: refusing to run against the database on "${host}". These tests write and delete data; ` +
        'point DATABASE_URL at a local database, or set E2E_ALLOW_REMOTE_DB=true if this is really a throwaway database.',
    );
  }
}
