import type { Metadata } from "next";

// Never listed in search, whatever else changes about access to /admin.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
