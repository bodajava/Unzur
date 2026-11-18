type Node = Record<string, unknown>;

/**
 * Several schema.org nodes go out as ONE object: { "@context", "@graph": [...] }.
 * A bare top-level array is valid JSON-LD, but some readers (WebKit/Safari's
 * page scanner among them) assume every ld+json block is an object with
 * "@context" and crash on arrays. Google reads @graph the same way.
 */
function normalize(data: Node | Node[]): Node {
  if (!Array.isArray(data)) return data;
  return {
    "@context": "https://schema.org",
    "@graph": data.map((node) => {
      const copy = { ...node };
      delete copy["@context"];
      return copy;
    }),
  };
}

/** Structured data for search engines. `<` is escaped so content cannot close the script tag. */
export function JsonLd({ data }: { data: Node | Node[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(normalize(data)).replace(/</g, "\\u003c") }}
    />
  );
}
