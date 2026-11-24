import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { InlineScript } from "@/components/theme/inline-script";
import { themeScript } from "@/components/theme/theme";
import { JsonLd } from "@/components/ui/json-ld";
import { alternatesFor, dirOf, locales, localePath, ogLocale, type Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { getDictionary, getLang } from "@/i18n/server";
import { getPublicSettings } from "@/lib/api/server";
import { contactInfo } from "@/lib/contact-info";
import { site } from "@/lib/site";
import { arabic, archivo, gothic } from "../fonts";
import "../globals.css";

/**
 * Every page reads the language from the URL (/en, /ar) to set <html lang dir>,
 * so no shell is shared across languages. Opt out of instant-navigation
 * validation (dev-only insight); both languages are still fully prerendered.
 */
export const instant = false;

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: `%s | ${site.name}` },
    description: t.meta.description,
    applicationName: site.name,
    keywords: [...site.keywords],
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
        { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: ["/favicon.ico"],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    alternates: alternatesFor(lang, "/"),
    openGraph: {
      type: "website",
      siteName: site.name,
      title: t.meta.title,
      description: t.meta.description,
      url: localePath(lang),
      locale: ogLocale[lang],
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
    },
    twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    category: "shopping",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1b44ff" },
    { media: "(prefers-color-scheme: dark)", color: "#05060f" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang: Locale = await getLang();
  const [t, settings] = await Promise.all([getDictionary(lang), getPublicSettings()]);
  const c = contactInfo(settings);
  const email = c.email ?? site.email;
  const telephone = c.phone ?? site.phone;
  const sameAs = Array.from(new Set([...site.sameAs, ...(c.instagram ? [c.instagram] : [])]));

  return (
    <html
      lang={lang}
      dir={dirOf(lang)}
      data-theme="light"
      suppressHydrationWarning
      className={`${archivo.variable} ${gothic.variable} ${arabic.variable}`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      {/* Browser extensions (ColorZilla, Grammarly…) add attributes to <body> before
          React loads. This only ignores attribute differences on <body> itself. */}
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${site.url}/#organization`,
              name: site.name,
              alternateName: [...site.alternateNames],
              url: site.url,
              // Google wants a stable square raster logo (112px+); use the 512px PNG.
              logo: `${site.url}/icon-512.png`,
              image: `${site.url}/icon-512.png`,
              email,
              telephone,
              address: {
                "@type": "PostalAddress",
                addressLocality: site.address.locality,
                addressRegion: site.address.region,
                addressCountry: site.address.country,
              },
              contactPoint: {
                "@type": "ContactPoint",
                telephone,
                email,
                contactType: "customer service",
                areaServed: site.address.country,
                availableLanguage: ["en", "ar"],
              },
              sameAs,
              description: t.meta.description,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${site.url}/${lang}#website`,
              name: site.name,
              alternateName: [...site.alternateNames],
              url: `${site.url}${localePath(lang)}`,
              inLanguage: lang,
              publisher: { "@id": `${site.url}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${site.url}${localePath(lang, "/search")}?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-blue focus:px-4 focus:py-2 focus:text-haze"
        >
          {t.common.skipToContent}
        </a>
        <I18nProvider lang={lang} dict={t}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
