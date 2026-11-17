import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { csvCell, csvRow, csvStream } from '../../common/utilities/csv.js';
import { NewsletterTokenService } from '../../common/services/security/newsletter-token.service.js';
import { WhatsAppService } from '../whatsapp/whatsapp.service.js';

describe('CSV export safety', () => {
  it('neutralizes spreadsheet formulas and quotes text', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell('+201001234567')).toBe(`"'+201001234567"`);
    expect(csvCell('-1+2')).toBe(`"'-1+2"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('قهوة, عربية')).toBe('"قهوة, عربية"');
    expect(csvCell(-12.5)).toBe('-12.5'); // real numbers stay numbers
    expect(csvCell(null)).toBe('');
    expect(csvRow(['a', 1, true])).toBe('"a",1,true\r\n');
  });

  it('starts the stream with a UTF-8 BOM', async () => {
    async function* rows() {
      yield ['أحمد', 100];
    }
    let out = '';
    for await (const chunk of csvStream(['name', 'total'], rows())) out += String(chunk);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toBe('﻿"name","total"\r\n"أحمد",100\r\n');
  });
});

describe('NewsletterTokenService', () => {
  const svc = new NewsletterTokenService(new ConfigService({ ENCRYPTION_KEY: 'k1', APP_BACKEND_URL: 'https://api.x' }));

  it('round-trips and rejects tampering or another key', () => {
    const token = svc.sign('Buyer@Example.com');
    expect(svc.verify(token)).toBe('buyer@example.com');
    const [payload, mac] = token.split('.');
    expect(svc.verify(`${Buffer.from('other@x.com').toString('base64url')}.${mac}`)).toBeNull();
    expect(svc.verify(`${payload}.${'0'.repeat(64)}`)).toBeNull();
    expect(svc.verify('garbage')).toBeNull();
    expect(new NewsletterTokenService(new ConfigService({ ENCRYPTION_KEY: 'k2' })).verify(token)).toBeNull();
    expect(svc.unsubscribeUrl('a@b.com')).toMatch(/^https:\/\/api\.x\/api\/v1\/newsletter\/unsubscribe\?token=/);
  });
});

describe('WhatsAppService', () => {
  const svc = new WhatsAppService(new ConfigService({ WHATSAPP_VERIFY_TOKEN: 'verify-me', WHATSAPP_APP_SECRET: 'app-secret' }));

  it('verifies Meta subscription and X-Hub-Signature-256', () => {
    expect(svc.verifySubscription('subscribe', 'verify-me', '12345')).toBe('12345');
    expect(svc.verifySubscription('subscribe', 'wrong', '12345')).toBeNull();
    expect(svc.verifySubscription('unsubscribe', 'verify-me', '12345')).toBeNull();
    const body = Buffer.from('{"entry":[]}');
    const sig = `sha256=${createHmac('sha256', 'app-secret').update(body).digest('hex')}`;
    expect(svc.verifySignature(body, sig)).toBe(true);
    expect(svc.verifySignature(Buffer.from('{"entry":[1]}'), sig)).toBe(false);
    expect(svc.verifySignature(body, undefined)).toBe(false);
  });

  it('formats Egyptian numbers and is a no-op without a token', async () => {
    expect(WhatsAppService.toWhatsAppNumber('0100 123 4567')).toBe('201001234567');
    expect(WhatsAppService.toWhatsAppNumber('+201001234567')).toBe('201001234567');
    await expect(svc.sendOrderStatusUpdate('01001234567', 'ORD-1', 'SHIPPED')).resolves.toEqual({ sent: false, reason: 'not_configured' });
    expect(svc.handleEvent({ entry: [{ changes: [{ value: { statuses: [{ id: 'w1', status: 'read' }] } }] }] })).toEqual({ statuses: 1 });
  });
});
