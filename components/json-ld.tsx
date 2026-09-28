/**
 * Structured data for search engines.
 *
 * `<` is escaped so text that ends up in the data — a product description
 * edited in /admin, say — can never close the script tag early.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
