import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share card: the wordmark on UNZUR blue. */
export default async function Image() {
  const gothic = await readFile(join(process.cwd(), "src/app/fonts/special-gothic-expanded-one.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1b44ff",
          color: "#e8e8e5",
          padding: 72,
          fontFamily: "Gothic",
        }}
      >
        <div style={{ fontSize: 34, color: "#a7b6ff", letterSpacing: 2 }}>SCULPTURAL FURNITURE &amp; LIGHTING</div>
        <div style={{ fontSize: 210, lineHeight: 0.85, letterSpacing: -8 }}>UNZUR</div>
        <div style={{ fontSize: 44 }}>LOOK CLOSER.</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Gothic", data: gothic, style: "normal", weight: 400 }] },
  );
}
