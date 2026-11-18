import { resolveMx } from 'node:dns/promises';
import { MxValidatorService } from './mx-validator.service.js';

vi.mock('node:dns/promises', () => ({ resolveMx: vi.fn() }));
const mockedResolve = vi.mocked(resolveMx);
const dnsError = (code: string) => Object.assign(new Error(code), { code });

function setup() {
  const store = new Map<string, unknown>();
  const cache = {
    get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: vi.fn((k: string, v: unknown) => Promise.resolve(void store.set(k, v))),
  };
  return { svc: new MxValidatorService(cache as never), cache };
}

describe('MxValidatorService', () => {
  beforeEach(() => mockedResolve.mockReset());

  it('accepts domains with MX records and caches the answer', async () => {
    mockedResolve.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);
    const { svc } = setup();
    expect(await svc.check('a@Example.com')).toBe('valid');
    expect(await svc.check('b@example.com')).toBe('valid');
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(mockedResolve).toHaveBeenCalledWith('example.com');
  });

  it('rejects ENOTFOUND / ENODATA and null MX', async () => {
    const { svc } = setup();
    mockedResolve.mockRejectedValueOnce(dnsError('ENOTFOUND'));
    expect(await svc.check('a@nope.example')).toBe('invalid');
    mockedResolve.mockRejectedValueOnce(dnsError('ENODATA'));
    expect(await svc.check('a@nomail.example')).toBe('invalid');
    mockedResolve.mockResolvedValueOnce([{ exchange: '', priority: 0 }]);
    expect(await svc.check('a@nullmx.example')).toBe('invalid');
    expect(await svc.check('no-at-sign')).toBe('invalid');
  });

  it('answers unknown (accepted) on timeout or DNS server failure, without caching', async () => {
    vi.useFakeTimers();
    const { svc, cache } = setup();
    mockedResolve.mockReturnValueOnce(new Promise(() => {}));
    const pending = svc.check('a@slow.example');
    await vi.advanceTimersByTimeAsync(3001);
    expect(await pending).toBe('unknown');
    vi.useRealTimers();
    mockedResolve.mockRejectedValueOnce(dnsError('ESERVFAIL'));
    expect(await svc.check('a@broken.example')).toBe('unknown');
    expect(cache.set).not.toHaveBeenCalled();
  });
});
