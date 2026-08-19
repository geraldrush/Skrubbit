/**
 * The company profile's prose, parsed once for every place it is shown.
 *
 * The profile is written in a single editable box in /admin, because it is
 * prose that changes shape as the business does. Two markers carry the
 * structure — "## " a heading, "- " a bullet — so the same text lays out as a
 * PDF for a supplier database, as a page on the website, and as the technical
 * section of a tender pack, without being maintained three times.
 */

export type ProfileBlock =
  | { kind: "heading"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "para"; text: string };

export function parseProfile(value: string): ProfileBlock[] {
  const out: ProfileBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "para", text: para.join(" ") });
    para = [];
  };

  for (const raw of value.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      out.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      flush();
      out.push({ kind: "bullet", text: line.slice(2).trim() });
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

/** Groups the blocks under their headings, for layouts that need sections. */
export function profileSections(
  value: string
): Array<{ heading: string; blocks: ProfileBlock[] }> {
  const sections: Array<{ heading: string; blocks: ProfileBlock[] }> = [];
  for (const block of parseProfile(value)) {
    if (block.kind === "heading") sections.push({ heading: block.text, blocks: [] });
    else {
      if (!sections.length) sections.push({ heading: "", blocks: [] });
      sections[sections.length - 1].blocks.push(block);
    }
  }
  return sections;
}
