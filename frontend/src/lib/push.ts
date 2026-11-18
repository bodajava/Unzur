"use client";

import { api } from "@/lib/api/client";
import type { Locale } from "@/i18n/config";

/**
 * Browser push through Firebase Cloud Messaging.
 * Needs the web app config from Firebase console → Project settings → General
 * (your web app) and the Web Push certificate key (Cloud Messaging tab).
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export type PushAudience = "staff" | "customer";
export type PushState = "unconfigured" | "unsupported" | "blocked" | "off" | "on";

const storeKey = (audience: PushAudience) => `unzur_push_${audience}`;
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: the toggle just won't remember */
  }
};

export const pushConfigured = () => Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId && VAPID_KEY);

function browserCanPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Where this browser stands for one audience, without asking anything. */
export function pushState(audience: PushAudience): PushState {
  if (!pushConfigured()) return "unconfigured";
  if (!browserCanPush()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && read(storeKey(audience)) ? "on" : "off";
}

async function token(): Promise<string> {
  const [{ getApps, initializeApp }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) throw new Error("unsupported");
  const app = getApps()[0] ?? initializeApp(config);
  const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

/**
 * Asks for permission (only when `ask`), gets this browser's token and saves it
 * on the API for the signed-in person or the guest session.
 */
export async function enablePush(audience: PushAudience, lang: Locale, ask = true): Promise<PushState> {
  if (!pushConfigured()) return "unconfigured";
  if (!browserCanPush()) return "unsupported";
  const permission = ask ? await Notification.requestPermission() : Notification.permission;
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  const t = await token();
  await api("/notifications/devices", { method: "POST", json: { token: t, lang, audience } });
  write(storeKey(audience), t);
  return "on";
}

export async function disablePush(audience: PushAudience): Promise<PushState> {
  const t = read(storeKey(audience));
  write(storeKey(audience), null);
  if (t) await api("/notifications/devices", { method: "DELETE", json: { token: t } }).catch(() => undefined);
  return pushState(audience);
}

/** Calls `fn` whenever a push arrives while a tab of the site is open. */
export function onPushMessage(fn: (data: { title?: string; body?: string; url?: string; tag?: string }) => void) {
  if (!browserCanPush()) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "unzur-push") fn(e.data.data ?? {});
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
