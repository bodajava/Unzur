import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LOGO_BOX, logoSvg } from "@/components/brand/logo-paths";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_WIDTH = 860;

/** Share card: the UNZUR mark on brand blue. */
export default async function Image() {
  const gothic = await readFile(join(process.cwd(), "src/app/fonts/special-gothic-expanded-one.ttf"));
  const logo = `data:image/svg+xml;base64,${Buffer.from(logoSvg("#e8e8e5")).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#1b44ff",
          color: "#e8e8e5",
          padding: 64,
          fontFamily: "Gothic",
        }}
      >
        <div style={{ fontSize: 30, color: "#a7b6ff", letterSpacing: 2 }}>SCULPTURAL FURNITURE &amp; LIGHTING</div>
        <img
          src={logo}
          alt=""
          width={LOGO_WIDTH}
          height={Math.round((LOGO_WIDTH * LOGO_BOX.height) / LOGO_BOX.width)}
        />
        <div style={{ fontSize: 40 }}>LOOK CLOSER.</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Gothic", data: gothic, style: "normal", weight: 400 }] },
  );
}
