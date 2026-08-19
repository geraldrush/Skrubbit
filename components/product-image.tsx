import Image from "next/image";

/**
 * A product's picture, or a stand-in when there isn't one yet.
 *
 * The catalogue grew to 43 products long before there were 43 photographs, and
 * `next/image` throws on an empty src — so a product without a picture would
 * take the whole shop page down rather than simply look unfinished.
 *
 * The stand-in names the product and its pack size rather than showing a
 * generic logo. On a shelf of look-alike white containers that is the only
 * thing a customer actually needs from the picture, so the page stays useful
 * while the photographs are taken.
 */
export function ProductImage({
  src,
  name,
  size,
  className = "",
  sizes,
  priority = false,
}: {
  src: string;
  name: string;
  /** Pack size to show on the stand-in, e.g. "5 L". */
  size?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        fill
        priority={priority}
        sizes={sizes}
        className={className}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-brand-yellow/15 to-brand-yellow/5 p-4 text-center"
      role="img"
      aria-label={size ? `${name}, ${size}` : name}
    >
      <span className="font-display text-sm font-bold uppercase leading-tight tracking-wide text-foreground sm:text-base">
        {name}
      </span>
      {size && (
        <span className="rounded-full border border-brand-yellow bg-background/80 px-3 py-0.5 text-xs font-semibold text-muted-foreground">
          {size}
        </span>
      )}
      <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
        Skrubb-it
      </span>
    </div>
  );
}
