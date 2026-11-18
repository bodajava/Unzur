import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const EYE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="313 0 74 71" fill="#e8e8e5"><mask id="o" maskUnits="userSpaceOnUse" x="300" y="0" width="100" height="72"><rect x="300" width="100" height="72" fill="#fff"/><path fill="#000" d="M350 15.21C361.37 15.21 395 24.17 395 35.5C395 46.83 361.37 55.79 350 55.79C338.63 55.79 307 46.83 307 35.5C307 24.17 338.63 15.21 350 15.21Z"/></mask><path mask="url(#o)" d="M350 2C368.78 2 384 17 384 35.5C384 54 368.78 69 350 69C331.22 69 316 54 316 35.5C316 17 331.22 2 350 2Z"/><circle cx="350" cy="35" r="12"/></svg>`;

/** Home-screen icon: the eye on brand blue (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1b44ff" }}>
        <img src={`data:image/svg+xml;base64,${Buffer.from(EYE).toString("base64")}`} alt="" width={112} height={107} />
      </div>
    ),
    size,
  );
}
