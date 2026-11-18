"use client";

import { useId, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useForgotPassword, useLogin, useRegister, useResetPassword, useVerifyOtp } from "@/lib/api/hooks";

const input =
  "mt-2 w-full rounded-xl border border-ink/25 bg-transparent px-4 py-3 hover:border-ink/50 focus:border-ink focus:outline-none";
const primary =
  "mt-8 w-full rounded-full bg-blue px-6 py-3.5 font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-60";

type Step =
  | { kind: "signIn" }
  | { kind: "signUp" }
  | { kind: "verify"; email: string; password: string }
  | { kind: "forgot" }
  | { kind: "reset"; email: string };

/**
 * Sign in, or create an account with just email + password, then a 6-digit
 * code from the inbox. Signing in to an unverified account sends a fresh code
 * and lands on the same step.
 */
export function AuthPanel() {
  const { t } = useI18n();
  const ta = t.account;
  const [step, setStep] = useState<Step>({ kind: "signIn" });
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display text-[clamp(2.4rem,6vw,4rem)]">{ta.title}</h1>
      <p className="mt-3 text-sm text-muted">{ta.intro}</p>

      {(step.kind === "signIn" || step.kind === "signUp") && (
        <div role="tablist" aria-label={ta.title} className="mt-8 grid grid-cols-2 rounded-full border border-ink/20 p-1 text-sm">
          {(["signIn", "signUp"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={step.kind === k}
              onClick={() => {
                setNotice(null);
                setStep({ kind: k });
              }}
              className={`rounded-full py-2 transition-colors ${step.kind === k ? "bg-ink text-canvas" : "hover:bg-ink/8"}`}
            >
              {k === "signIn" ? ta.signInTab : ta.signUpTab}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p role="status" className="mt-6 rounded-xl bg-ink/6 px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      {step.kind === "signIn" && (
        <SignIn
          onUnverified={(email, password) => setStep({ kind: "verify", email, password })}
          onForgot={() => {
            setNotice(null);
            setStep({ kind: "forgot" });
          }}
        />
      )}
      {step.kind === "signUp" && <SignUp onCreated={(email, password) => setStep({ kind: "verify", email, password })} />}
      {step.kind === "verify" && <Verify email={step.email} password={step.password} onBack={() => setStep({ kind: "signIn" })} />}
      {step.kind === "forgot" && <Forgot onSent={(email) => setStep({ kind: "reset", email })} onBack={() => setStep({ kind: "signIn" })} />}
      {step.kind === "reset" && (
        <Reset
          email={step.email}
          onDone={() => {
            setNotice(ta.resetDone);
            setStep({ kind: "signIn" });
          }}
          onBack={() => setStep({ kind: "signIn" })}
        />
      )}
    </div>
  );
}

function SignIn({ onUnverified, onForgot }: { onUnverified: (email: string, password: string) => void; onForgot: () => void }) {
  const { t } = useI18n();
  const ta = t.account;
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = login.error;
  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        login.mutate(
          { email: email.trim(), password },
          // 403 = the account exists but the email isn't confirmed; the API just sent a new code.
          { onError: (err) => err instanceof ApiError && err.status === 403 && /verify/i.test(err.message) && onUnverified(email.trim(), password) },
        );
      }}
    >
      <EmailField value={email} onChange={setEmail} />
      <PasswordField label={ta.password} value={password} onChange={setPassword} autoComplete="current-password" />
      <button type="button" onClick={onForgot} className="nav-link mt-3 text-xs">
        {ta.forgot}
      </button>
      <button type="submit" disabled={login.isPending} className={primary}>
        {login.isPending ? ta.signingIn : ta.signIn}
      </button>
      <Alert>{login.isError && (error instanceof ApiError && error.status === 401 ? ta.wrong : errorMessage(error, t))}</Alert>
    </form>
  );
}

function SignUp({ onCreated }: { onCreated: (email: string, password: string) => void }) {
  const { t } = useI18n();
  const ta = t.account;
  const register = useRegister();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const error = register.error;
  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) return setLocal(ta.tooShort);
        if (password !== confirm) return setLocal(ta.mismatch);
        setLocal(null);
        register.mutate({ email: email.trim(), password }, { onSuccess: () => onCreated(email.trim(), password) });
      }}
    >
      <EmailField value={email} onChange={setEmail} />
      <PasswordField label={ta.password} value={password} onChange={setPassword} autoComplete="new-password" hint={ta.passwordHint} />
      <PasswordField label={ta.confirmPassword} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <button type="submit" disabled={register.isPending} className={primary}>
        {register.isPending ? ta.signingUp : ta.signUp}
      </button>
      <Alert>{local ?? (register.isError && (error instanceof ApiError && error.status === 409 ? ta.exists : errorMessage(error, t)))}</Alert>
    </form>
  );
}

function Verify({ email, password, onBack }: { email: string; password: string; onBack: () => void }) {
  const { t } = useI18n();
  const ta = t.account;
  const verify = useVerifyOtp();
  // Signing in again is what sends a new code to an unverified account.
  const resend = useLogin();
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const id = useId();
  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        verify.mutate({ email, code });
      }}
    >
      <h2 className="text-xl font-semibold">{ta.verifyTitle}</h2>
      <p className="mt-2 text-sm text-muted">
        {fmt(ta.verifyIntro, { email: "⁨" + email + "⁩" })}
      </p>
      <label htmlFor={id} className="mt-6 block text-sm font-semibold">
        {ta.code}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        dir="ltr"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${input} text-center font-mono text-2xl tracking-[0.5em]`}
      />
      <button type="submit" disabled={verify.isPending || code.length !== 6} className={primary}>
        {verify.isPending ? ta.verifying : ta.verify}
      </button>
      <Alert>{verify.isError && ta.badCode}</Alert>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => resend.mutate({ email, password }, { onSettled: () => setResent(true) })}
          className="nav-link disabled:opacity-50"
        >
          {resend.isPending ? ta.resending : ta.resend}
        </button>
        <button type="button" onClick={onBack} className="nav-link">
          {ta.back}
        </button>
      </div>
      {resent && !resend.isPending && (
        <p role="status" className="mt-3 text-xs text-muted">
          {ta.resent}
        </p>
      )}
    </form>
  );
}

function Forgot({ onSent, onBack }: { onSent: (email: string) => void; onBack: () => void }) {
  const { t } = useI18n();
  const ta = t.account;
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");
  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        forgot.mutate(email.trim(), { onSuccess: () => onSent(email.trim()) });
      }}
    >
      <h2 className="text-xl font-semibold">{ta.forgotTitle}</h2>
      <p className="mt-2 text-sm text-muted">{ta.forgotIntro}</p>
      <EmailField value={email} onChange={setEmail} />
      <button type="submit" disabled={forgot.isPending} className={primary}>
        {forgot.isPending ? ta.sending : ta.sendCode}
      </button>
      <Alert>{forgot.isError && errorMessage(forgot.error, t)}</Alert>
      <button type="button" onClick={onBack} className="nav-link text-xs">
        {ta.back}
      </button>
    </form>
  );
}

function Reset({ email, onDone, onBack }: { email: string; onDone: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const ta = t.account;
  const reset = useResetPassword();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const id = useId();
  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) return setLocal(ta.tooShort);
        setLocal(null);
        reset.mutate({ email, code, newPassword: password }, { onSuccess: onDone });
      }}
    >
      <h2 className="text-xl font-semibold">{ta.forgotTitle}</h2>
      <p className="mt-2 text-sm text-muted">{fmt(ta.verifyIntro, { email: "⁨" + email + "⁩" })}</p>
      <label htmlFor={id} className="mt-6 block text-sm font-semibold">
        {ta.code}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        dir="ltr"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${input} text-center font-mono text-2xl tracking-[0.5em]`}
      />
      <PasswordField label={ta.newPassword} value={password} onChange={setPassword} autoComplete="new-password" hint={ta.passwordHint} />
      <button type="submit" disabled={reset.isPending || code.length !== 6} className={primary}>
        {reset.isPending ? ta.sending : ta.savePassword}
      </button>
      <Alert>{local ?? (reset.isError && ta.badCode)}</Alert>
      <button type="button" onClick={onBack} className="nav-link text-xs">
        {ta.back}
      </button>
    </form>
  );
}

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="mt-6 block text-sm font-semibold">
        {t.account.email}
      </label>
      <input
        id={id}
        type="email"
        dir="ltr"
        autoComplete="email"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} rtl:text-right`}
      />
    </>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="mt-5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          dir="ltr"
          autoComplete={autoComplete}
          required
          minLength={autoComplete === "new-password" ? 8 : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} pe-20 rtl:text-right`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="nav-link absolute end-4 top-1/2 mt-1 -translate-y-1/2 text-xs"
          aria-pressed={show}
        >
          {show ? t.account.hide : t.account.show}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 min-h-5 text-sm text-[#d1342f]">
      {children}
    </p>
  );
}
