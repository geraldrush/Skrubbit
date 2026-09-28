import type { Metadata } from "next";

// The checkout is a client page and cannot export metadata itself. It shows a
// visitor's own cart, which is nothing a search result should point at.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
