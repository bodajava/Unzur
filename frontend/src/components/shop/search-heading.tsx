import { fmt } from "@/i18n/format";
import { getDictionary } from "@/i18n/server";
import { parseListing } from "./query";

export async function SearchHeading({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ q }, t] = await Promise.all([searchParams.then(parseListing), getDictionary()]);
  return (
    <h1 className="display text-[clamp(2.4rem,7vw,6rem)] break-words">
      {q ? fmt(t.shop.searchFor, { q }) : t.shop.searchTitle}
    </h1>
  );
}
