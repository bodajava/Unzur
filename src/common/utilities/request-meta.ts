import { Lang } from '../enums/http.enum.js';
import type { RequestMeta } from '../interfaces/auth.interface.js';
import type { AppRequest } from '../interfaces/request.interface.js';

/** User agent, IP and preferred language (ar/en) of a request. */
export function requestMeta(req: AppRequest): RequestMeta {
  const accept = String(req.headers['accept-language'] ?? '').toLowerCase();
  return {
    userAgent: req.headers['user-agent']?.slice(0, 512),
    ipAddress: req.ip?.slice(0, 64),
    lang: accept.startsWith('ar') ? Lang.AR : Lang.EN,
  };
}
