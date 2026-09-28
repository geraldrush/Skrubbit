import { parseProfile } from "@/lib/profile-text";

/**
 * The company profile rendered as page copy.
 *
 * Same text, same markers, same source record as the downloadable PDF — so the
 * website and the document a buyer receives can never disagree about what the
 * company does.
 *
 * `hide` drops whole sections by heading (case-insensitive) from the page
 * only. The PDF and tender packs still carry them.
 */
export function ProfileProse({
  text,
  hide = [],
}: {
  text: string;
  hide?: string[];
}) {
  const hidden = new Set(hide.map((h) => h.toLowerCase()));
  let skipping = false;
  const blocks = parseProfile(text).filter((block) => {
    if (block.kind === "heading") {
      skipping = hidden.has(block.text.toLowerCase());
    }
    return !skipping;
  });
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (!bullets.length) return;
    out.push(
      <ul key={key} className="ml-1 grid gap-2 sm:grid-cols-2">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2 text-muted-foreground">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  blocks.forEach((block, i) => {
    if (block.kind === "bullet") {
      bullets.push(block.text);
      return;
    }
    flush(`ul-${i}`);
    if (block.kind === "heading") {
      out.push(
        <h2 key={i} className="font-display text-2xl font-extrabold sm:text-3xl">
          {block.text}
        </h2>
      );
    } else {
      out.push(
        <p key={i} className="max-w-prose text-muted-foreground">
          {block.text}
        </p>
      );
    }
  });
  flush("ul-last");

  return <div className="grid gap-4">{out}</div>;
}
