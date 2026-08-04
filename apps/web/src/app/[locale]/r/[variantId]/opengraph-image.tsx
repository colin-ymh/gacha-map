import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { parseSlug } from "./parse-stats";
import { WHITE, TEXT_DARK, TEXT_GRAY } from "@/styles/color";

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

  // 품목명은 길이 편차가 크다(짧게는 2자, 길게는 60자 이상). 고정 크기로 두면
  // 긴 이름이 카드를 넘치므로 길이에 따라 낮춘다.
  const nameLen = (displayName ?? "").length;
  const nameFontSize = nameLen > 24 ? 40 : nameLen > 14 ? 52 : 66;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: WHITE,
        fontFamily: "Pretendard",
        position: "relative",
      }}
    >
      {/* 브랜딩 — 우측 상단 고정 */}
      <img
        src={logoSrc}
        width={186}
        height={32}
        alt=""
        style={{ position: "absolute", top: 44, right: 56 }}
      />

      {/* 콘텐츠 행 — 배경을 걷어내 캔버스 전체가 하나의 흰 카드가 된다 */}
      <div
        style={{
          display: "flex",
          gap: 48,
          paddingLeft: 48,
          paddingRight: 48,
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

        {/* 우: 정보 — 이미지와 같은 높이 안에서 세로 중앙 정렬.
            로고가 카드 밖으로 나가 아래가 비므로 콘텐츠를 가운데로 모은다. */}
        <div
          style={{
            minHeight: 340,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            // 폭 상한이 없으면 긴 품목명이 카드 밖으로 넘친다.
            maxWidth: 460,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: TEXT_GRAY }}>
            {t("ogLead")}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: nameFontSize,
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
              marginTop: 36,
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
                        fontSize: 24,
                        color: TEXT_GRAY,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 48,
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
