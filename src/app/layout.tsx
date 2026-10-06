import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { BRAND, hasGithub } from "@/config/brand";
import { OG_IMAGE, hasX } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jetbrains", display: "swap" });

// "<Name> | <slogan>" fits in 65 characters, so the slogan is the title phrase.
const TITLE = `${BRAND.name} | ${BRAND.slogan}`;
const DESCRIPTION = BRAND.description;

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: TITLE, template: `%s | ${BRAND.name}` },
  description: DESCRIPTION,
  applicationName: BRAND.name,
  category: "finance",
  keywords: [BRAND.name, BRAND.symbol, "privacy protocol", "private balance", "zero-knowledge", "passive yield", BRAND.chainName],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    url: "/",
    siteName: BRAND.name,
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    ...(hasX ? { site: BRAND.xHandle, creator: BRAND.xHandle } : {}),
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = { themeColor: "#050506", viewportFit: "cover" };

const sameAs = [...(hasX ? [BRAND.x] : []), ...(hasGithub ? [BRAND.github] : [])];

const ORG = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BRAND.url}/#org`,
      name: BRAND.name,
      url: BRAND.url,
      logo: `${BRAND.url}/icon.png`,
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@type": "WebSite",
      "@id": `${BRAND.url}/#site`,
      name: BRAND.name,
      url: BRAND.url,
      description: DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${BRAND.url}/#org` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="overflow-x-clip font-sans text-[16px] antialiased">
        <JsonLd data={ORG} />
        <WalletProvider>
          <WalletModalProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded focus:bg-fg focus:px-3 focus:py-2 focus:text-paper">
              Skip to content
            </a>
            <SiteHeader />
            {children}
            <SiteFooter />
          </WalletModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
