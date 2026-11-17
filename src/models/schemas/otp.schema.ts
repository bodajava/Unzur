import type { Otp } from '../../generated/prisma/client.js';

export type { Otp };

/** Row shape returned by default queries (secret hash omitted). */
export type OtpEntity = Omit<Otp, 'codeHash'>;
