import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SHARE_SITE_ORIGIN } from "@/constants/share";
import { parseSlug } from "./parse-stats";
import ReferralPing from "./referral-ping";
import StoreLinks from "./store-links";
import {
  Page,
  HeaderLogo,
  Card,
  ProductImage,
  ImageFallback,
  AppIcon,
  VariantName,
  VariantSubName,
  Lead,
} from "./styles";

interface Props {
  params: Promise<{ locale: string; variantId: string }>;
  searchParams: Promise<{ ref?: string }>;
}

// 초대 코드는 user_profiles.referral_code 형식(혼동 글자를 뺀 32자 알파벳 10자리).
const REFERRAL_CODE_RE = /^[A-Z2-9]{10}$/;

export interface SharedVariant {
  name: string;
  name_ko: string | null;
  image_url: string | null;
}

// 공유 링크는 로그인하지 않은 제3자가 연다. gacha_product_variants는 상품·품목이
// 모두 active일 때 anon SELECT가 허용돼 있어 service_role이 필요 없다.
// (supabase/migrations/20260626_harden_gacha_product_variants_policies.sql)
async function getVariant(variantId: string): Promise<SharedVariant | null> {
  // UUID가 아닌 값이 들어오면 Postgres가 에러를 내므로 미리 거른다.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      variantId,
    )
  ) {
    return null;
  }

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, variantId: slug } = await params;
  const { variantId } = parseSlug(slug);
  const t = await getTranslations({ locale, namespace: "share" });
  const variant = variantId ? await getVariant(variantId) : null;
  const displayName = variant ? (variant.name_ko ?? variant.name) : null;

  return {
    // 루트 layout에 metadata가 없어 여기서 직접 지정해야 OG 이미지가 절대 URL이 된다.
    metadataBase: new URL(SHARE_SITE_ORIGIN),
    title: displayName ? t("ogTitle", { name: displayName }) : t("ogTitleAnon"),
    description: t("ogDescription"),
    openGraph: {
      title: displayName
        ? t("ogTitle", { name: displayName })
        : t("ogTitleAnon"),
      description: t("ogDescription"),
      url: `${SHARE_SITE_ORIGIN}/${locale}/r/${slug}`,
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function SharedRollPage({ params, searchParams }: Props) {
  const { locale, variantId: slug } = await params;
  const { ref } = await searchParams;
  const { variantId } = parseSlug(slug);
  const t = await getTranslations({ locale, namespace: "share" });
  const variant = variantId ? await getVariant(variantId) : null;
  const displayName = variant ? (variant.name_ko ?? variant.name) : null;
  const hasProduct = Boolean(displayName);

  const referralCode = ref && REFERRAL_CODE_RE.test(ref) ? ref : null;

  return (
    <Page>
      <HeaderLogo src="/gacha-map-logo.png" alt="Gacha Map" />

      {referralCode && (
        <ReferralPing code={referralCode} variantId={variantId} />
      )}

      <Lead>{hasProduct ? t("lead") : t("leadAnon")}</Lead>

      {hasProduct ? (
        <Card>
          {variant?.image_url ? (
            // OG 이미지와 달리 브라우저가 직접 로드하므로 next/image 최적화는 생략한다
            // (외부 호스트가 다양해 remotePatterns 관리 비용이 크다).
            <ProductImage src={variant.image_url} alt={displayName ?? ""} />
          ) : (
            <ImageFallback aria-hidden />
          )}

          <VariantName>{displayName}</VariantName>
          {variant?.name_ko && variant.name !== variant.name_ko && (
            <VariantSubName>{variant.name}</VariantSubName>
          )}
        </Card>
      ) : (
        <AppIcon src="/gacha-map-icon.png" alt="Gacha Map" />
      )}

      <StoreLinks
        appStoreLabel={t("openAppStore")}
        playStoreLabel={t("openPlayStore")}
        playComingSoonLabel={t("playComingSoon")}
      />
    </Page>
  );
}
