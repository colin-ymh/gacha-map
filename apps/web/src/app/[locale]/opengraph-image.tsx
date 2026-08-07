import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PRIMARY_BG } from "@/styles/color";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Gacha Map";

// 번들 포함은 next.config.ts의 outputFileTracingIncludes로 보장한다.
const ASSET_DIR = join(process.cwd(), "src/app/[locale]/_og-assets");

export default async function OpengraphImage() {
  const icon = await readFile(join(ASSET_DIR, "icon.png"));
  const iconSrc = `data:image/png;base64,${Buffer.from(icon).toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PRIMARY_BG,
      }}
    >
      <img
        src={iconSrc}
        width={280}
        height={280}
        alt=""
        style={{ borderRadius: 60 }}
      />
    </div>,
    size,
  );
}
