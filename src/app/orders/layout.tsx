import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Orders",
  description: "View and manage your ClawdGigs orders, deliveries, and order history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
