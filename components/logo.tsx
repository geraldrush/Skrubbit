import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { site } from "@/data/site";

export function Logo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={`${site.name} home`}
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/images/brand/logo-mark.webp"
        alt={`${site.legalName} logo`}
        width={482}
        height={165}
        priority={priority}
        className="h-12 w-auto sm:h-14"
      />
    </Link>
  );
}
