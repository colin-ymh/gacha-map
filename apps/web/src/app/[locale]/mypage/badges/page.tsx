"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { BadgeDefinition, UserBadge } from "@gacha-map/shared";

interface BadgesPageData {
  definitions: BadgeDefinition[];
  earned: UserBadge[];
  main_badge_id: string | null;
}

const TRACKS = [
  "quick_report",
  "shop_review",
  "new_shop_report",
  "closed_shop_report",
  "fix_info_report",
  "wishlist",
] as const;

type Track = (typeof TRACKS)[number];

const TRACK_I18N_KEYS: Record<Track, string> = {
  quick_report: "tracks.quickReport",
  shop_review: "tracks.shopReview",
  new_shop_report: "tracks.newShopReport",
  closed_shop_report: "tracks.closedShopReport",
  fix_info_report: "tracks.fixInfoReport",
  wishlist: "tracks.wishlist",
};

// ── Styled ─────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const BackButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textDark};
  padding: 0;
  line-height: 1;

  &:hover {
    opacity: 0.7;
  }
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const Body = styled.div`
  padding: 16px;
  overflow-y: auto;
`;

const LoadingText = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.gray500};
  font-size: ${({ theme }) => theme.fontSize.sm};
  padding: 24px 0;
`;

const OperatorSection = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primaryBg};
`;

const OperatorLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const OperatorBadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TrackSection = styled.div`
  margin-bottom: 24px;
`;

const TrackTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0 0 12px;
`;

const BadgeGrid = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const BadgeCard = styled.div<{ $earned: boolean; $isMain: boolean }>`
  width: 80px;
  padding: 12px 8px;
  border-radius: 12px;
  text-align: center;
  cursor: ${({ $earned }) => ($earned ? "pointer" : "default")};
  opacity: ${({ $earned }) => ($earned ? 1 : 0.4)};
  border: 2px solid
    ${({ $isMain, theme }) => ($isMain ? theme.colors.primary : "transparent")};
  background: ${({ $earned, theme }) =>
    $earned ? theme.colors.white : theme.colors.gray50};
  transition:
    border-color 0.15s,
    opacity 0.15s;

  &:hover {
    opacity: ${({ $earned }) => ($earned ? 0.85 : 0.4)};
  }
`;

const BadgeIconWrap = styled.div`
  font-size: 28px;
  margin-bottom: 4px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const BadgeIconImg = styled.img`
  width: 32px;
  height: 32px;
  object-fit: contain;
`;

const BadgeName = styled.div`
  font-size: 10px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textDark};
  word-break: keep-all;
  line-height: 1.3;
`;

const MainLabel = styled.div`
  font-size: 9px;
  color: ${({ theme }) => theme.colors.primary};
  margin-top: 2px;
  font-weight: 600;
`;

const LockedName = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.gray400};
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function BadgeIconDisplay({ iconUrl }: { iconUrl: string }) {
  if (iconUrl && iconUrl.startsWith("http")) {
    return (
      <BadgeIconWrap>
        <BadgeIconImg src={iconUrl} alt="" />
      </BadgeIconWrap>
    );
  }
  return <BadgeIconWrap>{iconUrl || "🏅"}</BadgeIconWrap>;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BadgesPage() {
  const router = useRouter();
  const t = useTranslations("gacha.badge");

  const [data, setData] = useState<BadgesPageData | null>(null);

  useEffect(() => {
    fetch("/api/users/badges")
      .then((r) => r.json())
      .then((json: BadgesPageData) => setData(json));
  }, []);

  if (!data) {
    return (
      <Wrapper>
        <Header>
          <BackButton onClick={() => router.back()}>‹</BackButton>
          <Title>{t("pageTitle")}</Title>
        </Header>
        <LoadingText>{t("loading")}</LoadingText>
      </Wrapper>
    );
  }

  const earnedMap = new Map(data.earned.map((b) => [b.badge_definition_id, b]));
  const operatorBadge = data.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === "operator",
  );

  async function toggleMainBadge(userBadgeId: string) {
    const newId = userBadgeId === data!.main_badge_id ? null : userBadgeId;
    await fetch("/api/users/badges/main", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: newId }),
    });
    setData((prev) => (prev ? { ...prev, main_badge_id: newId } : prev));
  }

  return (
    <Wrapper>
      <Header>
        <BackButton onClick={() => router.back()}>‹</BackButton>
        <Title>{t("pageTitle")}</Title>
      </Header>

      <Body>
        {operatorBadge && (
          <OperatorSection>
            <OperatorLabel>{t("operatorSection")}</OperatorLabel>
            <OperatorBadgeRow>
              <BadgeIconDisplay
                iconUrl={
                  (operatorBadge.badge_definitions as BadgeDefinition).icon_url
                }
              />
              <BadgeName>
                {(operatorBadge.badge_definitions as BadgeDefinition).name}
              </BadgeName>
            </OperatorBadgeRow>
          </OperatorSection>
        )}

        {TRACKS.map((track) => {
          const trackDefs = data.definitions.filter((d) => d.track === track);
          if (trackDefs.length === 0) return null;
          return (
            <TrackSection key={track}>
              <TrackTitle>
                {t(TRACK_I18N_KEYS[track] as Parameters<typeof t>[0])}
              </TrackTitle>
              <BadgeGrid>
                {trackDefs.map((def) => {
                  const userBadge = earnedMap.get(def.id);
                  const earned = !!userBadge;
                  const isMain = userBadge?.id === data.main_badge_id;
                  return (
                    <BadgeCard
                      key={def.id}
                      $earned={earned}
                      $isMain={isMain}
                      onClick={() => {
                        if (!earned || !userBadge) return;
                        toggleMainBadge(userBadge.id);
                      }}
                      title={earned ? def.name : undefined}
                    >
                      {earned ? (
                        <>
                          <BadgeIconDisplay iconUrl={def.icon_url} />
                          <BadgeName>{def.name}</BadgeName>
                          {isMain && <MainLabel>{t("mainLabel")}</MainLabel>}
                        </>
                      ) : (
                        <>
                          <BadgeIconWrap>🔒</BadgeIconWrap>
                          <LockedName>{t("locked")}</LockedName>
                        </>
                      )}
                    </BadgeCard>
                  );
                })}
              </BadgeGrid>
            </TrackSection>
          );
        })}
      </Body>
    </Wrapper>
  );
}
