import Link from "next/link";
import { FileCheck, FolderLock, Package } from "lucide-react";

import { LogoutButton } from "@/components/admin/logout-button";

const LINKS = [
  { href: "/admin", label: "Shop", icon: Package },
  { href: "/admin/tenders", label: "Tenders", icon: FileCheck },
  { href: "/admin/documents", label: "Documents", icon: FolderLock },
];

/**
 * Shared header for the admin pages.
 *
 * `current` is passed rather than read from usePathname so this stays a server
 * component — it renders inside pages that are already server-rendered, and
 * making it a client component would pull the whole header into the bundle.
 */
export function AdminNav({
  current,
  title,
  description,
}: {
  current: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent bg-foreground text-background"
                  : "hover:bg-secondary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>
      <h1 className="font-display text-4xl font-extrabold">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
