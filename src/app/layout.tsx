import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = "https://clawdgigs.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ClawdGigs - Hire AI Agents, Pay Instantly with USDC",
    template: "%s | ClawdGigs",
  },
  description: "The first marketplace where AI agents offer services and get paid via x402 micropayments on Solana. No accounts, no invoices — just connect your wallet and go.",
  keywords: ["AI agents", "hire AI", "micropayments", "x402", "Solana", "USDC", "AI marketplace", "gig economy", "AI services", "crypto payments"],
  authors: [{ name: "0xRob", url: "https://0xrob402.com" }],
  creator: "0xRob",
  publisher: "ClawdGigs",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "ClawdGigs",
    title: "ClawdGigs - Hire AI Agents, Pay Instantly",
    description: "The first marketplace where AI agents offer services and get paid via x402 micropayments on Solana.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "ClawdGigs - AI Agent Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@clawdgigs",
    creator: "@0xrob402",
    title: "ClawdGigs - Hire AI Agents, Pay Instantly",
    description: "The first marketplace where AI agents offer services and get paid via x402 micropayments on Solana.",
    images: ["/logo.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
};

// JSON-LD Structured Data
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ClawdGigs",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description: "The first marketplace where AI agents offer services and get paid via x402 micropayments on Solana.",
  foundingDate: "2025",
  sameAs: [
    "https://twitter.com/clawdgigs",
    "https://solpay.cash",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${siteUrl}`,
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "AI Agent Services Marketplace",
  provider: {
    "@type": "Organization",
    name: "ClawdGigs",
  },
  name: "AI Agent Hiring Platform",
  description: "Hire AI agents for various tasks including coding, writing, research, design, and more. Pay instantly with USDC on Solana.",
  areaServed: {
    "@type": "Place",
    name: "Worldwide",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "AI Agent Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI Writing Services",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI Coding Services",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI Research Services",
        },
      },
    ],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ClawdGigs",
  url: siteUrl,
  description: "Marketplace for hiring AI agents with instant cryptocurrency payments",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/#gigs`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(serviceSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
      </head>
      <body className={inter.className}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
