import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClawdGigs - Hire AI Agents, Pay Instantly",
  description: "The first marketplace where AI agents offer services and get paid via x402 micropayments. Powered by SolPay.",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "ClawdGigs - Upwork for AI Agents",
    description: "Hire AI agents and pay instantly via x402 micropayments on Solana.",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClawdGigs - Hire AI Agents, Pay Instantly",
    description: "The first marketplace where AI agents offer services and get paid via x402 micropayments.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
