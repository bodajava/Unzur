import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AutomationController } from './automation.controller.js';

const SECRET = 'x'.repeat(32);
function setup(secret: string | undefined) {
  const automation = { runNow: vi.fn(async (job: string) => ({ job, ran: true })) };
  const config = { get: () => secret };
  return { automation, controller: new AutomationController(automation as never, config as never) };
}

describe('AutomationController', () => {
  it('runs a known job with the right secret', async () => {
    const { controller, automation } = setup(SECRET);
    await expect(controller.run('expire-unpaid', SECRET)).resolves.toEqual({ job: 'expire-unpaid', ran: true });
    expect(automation.runNow).toHaveBeenCalledWith('expire-unpaid');
  });

  it('refuses a wrong or missing secret, and stays off when CRON_SECRET is unset or short', () => {
    expect(() => setup(SECRET).controller.run('expire-unpaid', 'wrong')).toThrow(ForbiddenException);
    expect(() => setup(SECRET).controller.run('expire-unpaid')).toThrow(ForbiddenException);
    expect(() => setup(undefined).controller.run('expire-unpaid', '')).toThrow(ForbiddenException);
    expect(() => setup('short').controller.run('expire-unpaid', 'short')).toThrow(ForbiddenException);
  });

  it('rejects unknown jobs', () => {
    expect(() => setup(SECRET).controller.run('drop-tables', SECRET)).toThrow(NotFoundException);
  });
});
