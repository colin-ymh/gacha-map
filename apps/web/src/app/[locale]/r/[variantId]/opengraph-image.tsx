import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  PRIMARY,
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
 * 링크 프리뷰가 통째로 깨진다. 폴백 배경만 두는 것으로는 막을 수 없으므로,
 * 상태 코드와 Content-Type을 먼저 검증하고 실패하면 <img>를 아예 렌더하지 않는다.
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
  const { locale, variantId } = await params;
  const t = await getTranslations({ locale, namespace: "share" });
  const variant = await getVariant(variantId);
  const displayName = variant ? (variant.name_ko ?? variant.name) : null;
  const showImage = await isRenderableImage(variant?.image_url ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
          padding: "0 80px",
          background: `linear-gradient(180deg, ${WHITE} 0%, ${PRIMARY_BG} 100%)`,
        }}
      >
        {/* 좌: 상품 이미지 */}
        <div
          style={{
            width: 380,
            height: 380,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 32,
            backgroundColor: WHITE,
            border: `1px solid ${BORDER}`,
          }}
        >
          {showImage ? (
            <img
              src={variant!.image_url as string}
              width={320}
              height={320}
              style={{ objectFit: "contain" }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 320,
                height: 320,
                borderRadius: 24,
                backgroundColor: PRIMARY_BG,
              }}
            />
          )}
        </div>

        {/* 우: 텍스트 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 560,
          }}
        >
          <div style={{ fontSize: 28, color: TEXT_GRAY, marginBottom: 16 }}>
            {t("ogLead")}
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 800,
              color: TEXT_DARK,
              lineHeight: 1.2,
            }}
          >
            {displayName ?? t("ogTitleAnon")}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 4,
              color: PRIMARY,
              marginTop: 40,
            }}
          >
            GACHA MAP
          </div>
        </div>
      </div>
    ),
    size,
  );
}
