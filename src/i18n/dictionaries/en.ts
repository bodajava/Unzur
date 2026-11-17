import type { Plural } from "../format";

/** English copy. `ar.ts` must have exactly the same keys (it is typed against this). */
export const en = {
  meta: {
    title: "UNZUR — Sculptural furniture & lighting",
    description:
      "UNZUR designs sculptural furniture and lighting shaped by architecture and imagination. Shop chairs, tables, shelves and lamps made to be looked at.",
    bestSellersList: "UNZUR best sellers",
  },
  common: {
    skipToContent: "Skip to content",
    close: "Close",
    home: "Home",
    arrow: "→",
    tagline: "Look, or stop looking",
  },
  nav: {
    main: "Main",
    mobile: "Mobile",
    menu: "Menu",
    bestSellers: "Best sellers",
    account: "Account",
    search: "Search",
    cart: "Cart: {count}",
    cartLabel: { one: "Cart, {count} item", other: "Cart, {count} items" } as Plural,
    homeLabel: "UNZUR home",
    language: "عربي",
    languageLabel: "اقرأ الموقع بالعربية",
    marquee: ["UNZUR", "انظر أو كُفّ عن النظر", "Look, or stop looking", "Furniture & lighting"],
  },
  theme: {
    night: "Night",
    day: "Day",
    toNight: "Switch to night mode",
    toDay: "Switch to day mode",
  },
  hero: {
    titleLine1: "Look",
    titleLine2: "closer.",
    eyebrow: "Sculptural furniture & lighting",
    body: "Chairs, tables and lights shaped by architecture and imagination. Every piece is made to be looked at.",
    cta: "Shop the pieces",
    collections: "Collections",
    rulerStart: "Look",
    rulerEnd: "Look closer",
    scrollHint: "Scroll to fly in",
  },
  concept: {
    title: "The concept",
    intro: "Pieces made with the freedom of art. UNZUR does not design furniture to fill a room; it designs it to give the room a character.",
    body: "Pieces stripped down to art, free in what they say. They step past the familiar to redraw the line between furniture and space. Their shapes come from architecture, geometry and imagination, pairing boldness with simplicity in details that carry a character of their own. UNZUR does not design furniture to fill a void, but to give it a personality: every piece a presence of its own, every angle a chance to see things differently.",
    bodyLang: "en",
  },
  pieces: {
    title: "Best sellers",
    count: { one: "{count} piece", other: "{count} pieces" } as Plural,
    shopAll: "Shop all",
    empty: "New pieces are on their way. Join the newsletter below to hear first.",
  },
  collections: {
    eyebrow: "Shop by category",
    title: "Collections",
  },
  product: {
    was: "was",
  },
  search: {
    dialog: "Search",
    label: "Search pieces",
    placeholder: "Search pieces",
    hint: "Type at least 2 letters — English or عربي",
    unavailable: "Search is not available right now. Try again in a moment.",
    noMatch: "No pieces match “{q}”. Try another word.",
  },
  newsletter: {
    title: "Newsletter",
    blurb: "New pieces and studio news, a few times a season.",
    label: "Email address",
    placeholder: "Email address",
    submit: "Subscribe",
    submitting: "Subscribing…",
    CREATED: "You're on the list. Check your inbox.",
    REACTIVATED: "Welcome back. You're subscribed again.",
    ALREADY_SUBSCRIBED: "You're already on the list.",
  },
  footer: {
    columns: [
      {
        title: "Company",
        links: [
          { href: "/contact", label: "Contact us" },
          { href: "/care", label: "Product care" },
          { href: "/faq", label: "FAQs" },
        ],
      },
      {
        title: "Policies",
        links: [
          { href: "/customer-care", label: "Customer care" },
          { href: "/returns", label: "Returns & exchanges" },
          { href: "/warranty", label: "Repair & warranty" },
        ],
      },
      {
        title: "Customer service",
        links: [
          { href: "/stories", label: "Stories" },
          { href: "/careers", label: "Careers" },
          { href: "/terms", label: "Terms & conditions" },
          { href: "/privacy", label: "Privacy policy" },
        ],
      },
    ],
    rights: "© UNZUR",
  },
  notFound: {
    title: "Nothing to look at here.",
    body: "This page doesn't exist, or it moved. The pieces are still where you left them.",
    back: "Back to the home page",
  },
  errors: {
    network: "Can't reach the store right now. Check your connection and try again.",
    generic: "Something went wrong. Try again.",
    sessionExpired: "Your session ended. Log in again to continue.",
  },
  orderStatus: {
    PENDING_PAYMENT: "Waiting for payment",
    CONFIRMED: "Confirmed",
    PREPARING: "Preparing",
    SHIPPED: "On the way",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  },
  paymentStatus: {
    UNPAID: "Unpaid",
    PENDING: "Payment pending",
    PAID: "Paid",
    FAILED: "Payment failed",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partly refunded",
  },
  paymentMethod: {
    COD: "Cash on delivery",
    PAYMOB_CARD: "Card",
    PAYMOB_WALLET: "Mobile wallet",
  },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Dictionary = Widen<typeof en>;
