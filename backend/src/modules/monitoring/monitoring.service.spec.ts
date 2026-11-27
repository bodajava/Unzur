import { describe, expect, it, vi } from 'vitest';
import { ErrorAlertsListener, MAX_ALERTS_PER_HOUR, errorSignature } from './error-alerts.listener.js';

const event = (where: string, message = 'boom') => ({ where, message, at: '2026-11-27T10:15:00.000Z' });

describe('errorSignature', () => {
  it('groups the same error on different ids, numbers and query strings', () => {
    const a = errorSignature(event('GET /api/v1/orders/1b2c3d4e-0000-4000-8000-000000000001?x=1', 'Timeout after 3000ms'));
    const b = errorSignature(event('GET /api/v1/orders/9f9f9f9f-1111-4111-8111-111111111111', 'Timeout after 5000ms'));
    expect(a).toBe(b);
  });

  it('keeps different routes apart', () => {
    expect(errorSignature(event('GET /api/v1/cart'))).not.toBe(errorSignature(event('GET /api/v1/orders')));
  });
});

describe('ErrorAlertsListener.shouldSend', () => {
  const make = (redis: Record<string, unknown>) =>
    new ErrorAlertsListener({ get: () => 'alerts@example.test' } as never, redis as never, {} as never);

  it('sends a new error once, then stays quiet for repeats', async () => {
    const seen = new Set<string>();
    let count = 0;
    const listener = make({
      setIfAbsent: vi.fn(async (k: string) => (seen.has(k) ? false : (seen.add(k), true))),
      incr: vi.fn(async () => ++count),
      expire: vi.fn(async () => true),
    });
    expect(await listener.shouldSend(event('GET /x'))).toBe(true);
    expect(await listener.shouldSend(event('GET /x'))).toBe(false);
  });

  it('stops after the hourly cap', async () => {
    const listener = make({
      setIfAbsent: vi.fn(async () => true),
      incr: vi.fn(async () => MAX_ALERTS_PER_HOUR + 1),
      expire: vi.fn(async () => true),
    });
    expect(await listener.shouldSend(event('GET /y'))).toBe(false);
  });

  it('sends nothing when Redis is unavailable', async () => {
    const listener = make({ setIfAbsent: vi.fn(async () => { throw new Error('down'); }) });
    expect(await listener.shouldSend(event('GET /z'))).toBe(false);
  });
});

describe('AiGatewayClient daily budget', () => {
  it('allows calls up to AI_DAILY_LIMIT, alerts at 80% and when used up, then refuses', async () => {
    const { AiGatewayClient } = await import('../ai/ai-gateway.client.js');
    const { ConfigService } = await import('@nestjs/config');
    let n = 0;
    const redis = { incr: vi.fn(async () => ++n), expire: vi.fn(async () => true) };
    const emit = vi.fn();
    const client = new AiGatewayClient(new ConfigService({ AI_DAILY_LIMIT: '5' }), redis as never, { emit } as never);
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) results.push(await client.withinBudget());
    expect(results).toEqual([true, true, true, true, true, false, false]);
    expect(emit).toHaveBeenCalledTimes(2); // 80% (4th call) and over the limit (6th call)
  });
});
