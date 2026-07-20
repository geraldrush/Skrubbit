import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center gap-5 py-28 text-center">
      <p className="font-display text-7xl font-extrabold text-primary drop-shadow-sm">
        404
      </p>
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for has been cleaned away. Let&apos;s get
        you back to the good stuff.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop">Shop products</Link>
        </Button>
      </div>
    </div>
  );
}
