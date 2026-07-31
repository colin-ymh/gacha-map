import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { parseSlug } from "./parse-stats";
import {
  PRIMARY_BG,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
} from "@/styles/color";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Gacha Map";

interface Props {
  params: Promise<{ locale: string; variantId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// satori는 WOFF2와 가변 폰트를 지원하지 않는다. 웹에서 쓰는 Pretendard Variable
// woff2를 그대로 못 쓰므로 같은 서체의 static OTF를 읽어 넘긴다.
//
// Next 문서의 `fetch(new URL(..., import.meta.url))` 패턴은 edge 런타임 전제라
// Node 런타임에서는 file: 프로토콜 미지원으로 실패한다("not implemented... yet...").
// 대신 fs로 읽고, 번들 포함은 next.config.ts의 outputFileTracingIncludes로 보장한다.
const ASSET_DIR = join(
  process.cwd(),
  "src/app/[locale]/r/[variantId]/og-assets",
);
const loadAsset = (file: string) => readFile(join(ASSET_DIR, file));

// 개인 통계(시도 횟수 등)는 링크를 가진 누구나 보게 되므로 넣지 않는다.
async function getVariant(variantId: string) {
  if (!UUID_RE.test(variantId)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("gacha_product_variants")
      .select("name, name_ko, image_url")
      .eq("id", variantId)
      .eq("status", "active")
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 원격 이미지를 렌더해도 되는지 미리 확인한다.
 *
 * ImageResponse 안에서 <img src>가 fetch에 실패하면 OG 응답 자체가 500이 되어
 * 링크 프리뷰가 통째로 깨진다. 상태 코드와 Content-Type을 먼저 검증하고
 * 실패하면 <img>를 아예 렌더하지 않는다.
 */
async function isRenderableImage(url: string | null): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    return (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

export default async function OpengraphImage({ params }: Props) {
  const { locale, variantId: slug } = await params;
  const { variantId, stats: shared } = parseSlug(slug);
  const t = await getTranslations({ locale, namespace: "share" });

  const [variant, regular, bold, logo] = await Promise.all([
    variantId ? getVariant(variantId) : null,
    loadAsset("./Pretendard-Regular.otf"),
    loadAsset("./Pretendard-Bold.otf"),
    loadAsset("./logo.png"),
  ]);

  const displayName = variant ? (variant.name_ko ?? variant.name) : null;
  const showImage = await isRenderableImage(variant?.image_url ?? null);
  const logoSrc = `data:image/png;base64,${Buffer.from(logo).toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg, ${WHITE} 0%, ${PRIMARY_BG} 100%)`,
        fontFamily: "Pretendard",
      }}
    >
      {/* 수집 카드 — 앱 결과 카드의 가로(라이선스) 버전 */}
      <div
        style={{
          width: 940,
          display: "flex",
          padding: 48,
          gap: 48,
          borderRadius: 32,
          backgroundColor: WHITE,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
        }}
      >
        {/* 좌: 상품 이미지 — 카드가 이미 흰 바탕이라 별도 배경을 두지 않는다 */}
        <div
          style={{
            width: 340,
            height: 340,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showImage ? (
            <img
              src={variant!.image_url as string}
              width={290}
              height={290}
              style={{ objectFit: "contain" }}
              alt=""
            />
          ) : (
            <div style={{ width: 290, height: 290 }} />
          )}
        </div>

        {/* 우: 정보 */}
        <div
          style={{
            height: 340,
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, color: TEXT_GRAY }}>
            {t("ogLead")}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              color: TEXT_DARK,
              lineHeight: 1.2,
              marginTop: 12,
            }}
          >
            {displayName ?? t("ogTitleAnon")}
          </div>

          {/* 통계 — 링크에 실려온 값이 있을 때만 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              justifyContent: "center",
            }}
          >
            {shared ? (
              <div style={{ display: "flex", gap: 56 }}>
                {[
                  { label: t("statTries"), value: shared.tries },
                  { label: t("statOwned"), value: shared.owned },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{ display: "flex", flexDirection: "column" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontSize: 20,
                        color: TEXT_GRAY,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 40,
                        fontWeight: 700,
                        color: TEXT_DARK,
                        marginTop: 4,
                      }}
                    >
                      {t("countUnit", { count: s.value })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* 하단 브랜딩 */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <img src={logoSrc} width={158} height={27} alt="" />
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
