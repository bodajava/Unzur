import { Lang } from '../../enums/http.enum.js';
import { OtpType } from '../../enums/prisma.enums.js';
import { escapeHtml } from './escape-html.js';
import { layoutTemplate } from './layout.template.js';

const COPY = {
  [OtpType.EMAIL_VERIFICATION]: {
    [Lang.EN]: {
      subject: 'Verify your email',
      greeting: (n: string) => `Hi ${n},`,
      intro: 'Use this code to verify your email address:',
    },
    [Lang.AR]: {
      subject: 'تأكيد البريد الإلكتروني',
      greeting: (n: string) => `أهلاً ${n}،`,
      intro: 'استخدم هذا الرمز لتأكيد بريدك الإلكتروني:',
    },
  },
  [OtpType.PASSWORD_RESET]: {
    [Lang.EN]: {
      subject: 'Reset your password',
      greeting: (n: string) => `Hi ${n},`,
      intro: 'Use this code to reset your password. If you did not request this, you can ignore this email.',
    },
    [Lang.AR]: {
      subject: 'إعادة تعيين كلمة المرور',
      greeting: (n: string) => `أهلاً ${n}،`,
      intro: 'استخدم هذا الرمز لإعادة تعيين كلمة المرور. إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
    },
  },
} as const;

const EXPIRY = {
  [Lang.EN]: 'This code expires in 10 minutes. Never share it with anyone.',
  [Lang.AR]: 'ينتهي هذا الرمز خلال 10 دقائق. لا تشاركه مع أي شخص.',
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function otpEmail(opts: {
  type: OtpType;
  lang: Lang;
  brandName: string;
  firstName: string;
  code: string;
}): RenderedEmail {
  const copy = COPY[opts.type][opts.lang];
  const body = `
    <p style="margin:0 0 16px;font-size:16px">${escapeHtml(copy.greeting(opts.firstName))}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${escapeHtml(copy.intro)}</p>
    <p dir="ltr" style="margin:0 0 24px;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center">${escapeHtml(opts.code)}</p>
    <p style="margin:0;font-size:13px;color:#78716c">${EXPIRY[opts.lang]}</p>`;

  return {
    subject: `${copy.subject} - ${opts.brandName}`,
    html: layoutTemplate({ lang: opts.lang, brandName: opts.brandName, preheader: copy.intro, body }),
    text: `${copy.greeting(opts.firstName)}\n\n${copy.intro}\n\n${opts.code}\n\n${EXPIRY[opts.lang]}`,
  };
}
