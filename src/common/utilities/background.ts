import { Logger } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';

const logger = new Logger('Background');

/**
 * Fire-and-forget: the request does not wait for `task`.
 * On Vercel, waitUntil keeps the function alive until the task settles.
 * Errors are logged, never thrown to the caller.
 */
export function runInBackground(name: string, task: () => Promise<unknown>): void {
  const promise = Promise.resolve()
    .then(task)
    .catch((error: unknown) => {
      logger.error(
        `Background task "${name}" failed: ${(error as Error)?.message ?? error}`,
      );
    });

  if (process.env.VERCEL) waitUntil(promise);
}
