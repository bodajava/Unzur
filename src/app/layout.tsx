import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/ui/json-ld";
import { getCategories } from "@/lib/api/server";
import { site } from "@/lib/site";
import { archivo, gothic, plexArabic } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.title,
    description: site.description,
    url: "/",
    locale: site.locale,
    alternateLocale: ["ar_EG"],
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  category: "shopping",
};

export const viewport: Viewport = {
  themeColor: "#1b44ff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categories = await getCategories();
  return (
    <html lang="en" dir="ltr" className={`${archivo.variable} ${gothic.variable} ${plexArabic.variable}`}>
      <body className="min-h-dvh antialiased">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${site.url}/#organization`,
              name: site.name,
              alternateName: site.nameAr,
              url: site.url,
              logo: `${site.url}/icon.svg`,
              description: site.description,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${site.url}/#website`,
              name: site.name,
              url: site.url,
              inLanguage: ["en", "ar"],
              publisher: { "@id": `${site.url}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: `${site.url}/search?q={search_term_string}` },
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-blue focus:px-4 focus:py-2 focus:text-haze"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader categories={categories} />
          <main id="main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
