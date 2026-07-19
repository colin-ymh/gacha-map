"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { BadgeDefinition, UserBadge } from "@gacha-map/shared";

interface BadgesPageData {
  earned: UserBadge[];
  main_badge_id: string | null;
  definitions: BadgeDefinition[];
}

// ── Styled ─────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 52px;
  flex-shrink: 0;
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
  flex: 1;
  text-align: center;
  margin-right: 24px;
`;

const Body = styled.div`
  padding: 16px;
  overflow-y: auto;
  flex: 1;
`;

const MotivationText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0 0 16px;
`;

const LoadingText = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.gray500};
  font-size: ${({ theme }) => theme.fontSize.sm};
  padding: 40px 0;
`;

const SectionLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray600};
  margin: 20px 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

// ── 대표 배지 섹션 ──────────────────────────────────────────────────────────────

const MainBadgeSection = styled.div<{ $hasMain: boolean }>`
  border-radius: 12px;
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.primaryBg};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  margin-bottom: 8px;
`;

const MainBadgeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const MainBadgeLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const MainBadgeActionBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  padding: 0;

  &:hover {
    opacity: 0.7;
  }
`;

const MainBadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NoMainText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
`;

// ── Badge Row ──────────────────────────────────────────────────────────────────

const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.white};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s;

  &:hover {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
`;

const LockedRow = styled(BadgeRow)`
  cursor: default;
  opacity: 0.5;

  &:hover {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
`;

const BadgeIconWrap = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primaryBg};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22px;
`;

const LockedIconWrap = styled(BadgeIconWrap)`
  background: ${({ theme }) => theme.colors.gray100};
  filter: grayscale(1);
`;

const BadgeIconImg = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
`;

const LockedIconImg = styled(BadgeIconImg)`
  filter: grayscale(1);
`;

const BadgeInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const BadgeName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  margin-bottom: 3px;
`;

const LockedName = styled(BadgeName)`
  color: ${({ theme }) => theme.colors.gray400};
  font-weight: 500;
`;

const BadgeDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textGray};
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MainPill = styled.div`
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primaryBg};
  padding: 3px 8px;
  border-radius: 20px;
`;

const LockIcon = styled.span`
  flex-shrink: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.gray400};
`;

// ── Operator Section ──────────────────────────────────────────────────────────

const OperatorSection = styled.div`
  border-radius: 12px;
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.primaryBg};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const OperatorLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
`;

// ── Modal ──────────────────────────────────────────────────────────────────────

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

const ModalCard = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 70vh;
  overflow-y: auto;
  padding-bottom: 24px;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const ModalCloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textGray};
  padding: 4px;
  line-height: 1;

  &:hover {
    opacity: 0.7;
  }
`;

const ModalOptionRow = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primaryBg : "transparent"};
  transition: background 0.1s;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const ModalDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.gray100};
  margin: 0 20px;
`;

const RadioOuter = styled.div<{ $selected: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.gray400};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary : "transparent"};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const RadioInner = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.white};
`;

const RemoveMainBtn = styled.button`
  display: block;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
  text-align: center;
  padding: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.gray100};
  margin-top: 4px;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

const BADGE_TRACKS = [
  "quick_report",
  "shop_review",
  "new_shop_report",
  "closed_shop_report",
  "fix_info_report",
  "wishlist",
  "gacha_roll_variety",
  "gacha_roll_days",
] as const;

function computeLockedBadges(
  definitions: BadgeDefinition[],
  earned: UserBadge[],
): BadgeDefinition[] {
  const earnedDefIds = new Set(earned.map((b) => b.badge_definition_id));
  return BADGE_TRACKS.map((track) =>
    definitions
      .filter((d) => d.track === track)
      .sort((a, b) => a.tier - b.tier)
      .find((d) => !earnedDefIds.has(d.id)),
  ).filter((d): d is BadgeDefinition => d !== undefined);
}

function BadgeIcon({
  iconUrl,
  locked = false,
}: {
  iconUrl: string;
  locked?: boolean;
}) {
  const Wrap = locked ? LockedIconWrap : BadgeIconWrap;
  if (iconUrl?.startsWith("http")) {
    const Img = locked ? LockedIconImg : BadgeIconImg;
    return (
      <Wrap>
        <Img src={iconUrl} alt="" />
      </Wrap>
    );
  }
  return <Wrap>{iconUrl || "🏅"}</Wrap>;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BadgesPage() {
  const router = useRouter();
  const t = useTranslations("gacha.badge");

  const [data, setData] = useState<BadgesPageData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/users/badges")
      .then((r) => r.json())
      .then((json: BadgesPageData) => setData(json));
  }, []);

  async function setMainBadge(userBadgeId: string | null) {
    await fetch("/api/users/badges/main", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: userBadgeId }),
    });
    setData((prev) => (prev ? { ...prev, main_badge_id: userBadgeId } : prev));
    setModalOpen(false);
  }

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

  const operatorBadge = data.earned.find(
    (b) => (b.badge_definitions as BadgeDefinition).track === "operator",
  );
  const regularBadges = data.earned.filter(
    (b) => (b.badge_definitions as BadgeDefinition).track !== "operator",
  );
  const lockedBadges = computeLockedBadges(data.definitions, data.earned);

  const mainUserBadge = regularBadges.find((b) => b.id === data.main_badge_id);
  const mainDef = mainUserBadge
    ? (mainUserBadge.badge_definitions as BadgeDefinition)
    : null;

  return (
    <>
      <Wrapper>
        <Header>
          <BackButton onClick={() => router.back()}>‹</BackButton>
          <Title>{t("pageTitle")}</Title>
        </Header>

        <Body>
          <MotivationText>{t("motivationText")}</MotivationText>

          {/* 대표 배지 섹션 */}
          <MainBadgeSection $hasMain={!!mainDef}>
            <MainBadgeHeader>
              <MainBadgeLabel>{t("mainSection")}</MainBadgeLabel>
              <MainBadgeActionBtn onClick={() => setModalOpen(true)}>
                {mainDef ? t("changeMain") : t("setMain")}
              </MainBadgeActionBtn>
            </MainBadgeHeader>
            {mainDef ? (
              <MainBadgeRow>
                <BadgeIcon iconUrl={mainDef.icon_url} />
                <BadgeInfo>
                  <BadgeName>{mainDef.name}</BadgeName>
                  <BadgeDesc>{mainDef.description}</BadgeDesc>
                </BadgeInfo>
              </MainBadgeRow>
            ) : (
              <NoMainText>{t("noMainBadge")}</NoMainText>
            )}
          </MainBadgeSection>

          {/* 운영자 배지 */}
          {operatorBadge && (
            <>
              <SectionLabel>{t("operatorSection")}</SectionLabel>
              <OperatorSection>
                <BadgeIcon
                  iconUrl={
                    (operatorBadge.badge_definitions as BadgeDefinition)
                      .icon_url
                  }
                />
                <BadgeInfo>
                  <BadgeName>
                    {(operatorBadge.badge_definitions as BadgeDefinition).name}
                  </BadgeName>
                </BadgeInfo>
              </OperatorSection>
            </>
          )}

          {/* 획득한 배지 */}
          {regularBadges.length > 0 && (
            <>
              <SectionLabel>{t("earnedSection")}</SectionLabel>
              {regularBadges.map((userBadge) => {
                const def = userBadge.badge_definitions as BadgeDefinition;
                const isMain = userBadge.id === data.main_badge_id;
                return (
                  <BadgeRow
                    key={userBadge.id}
                    onClick={() => setMainBadge(isMain ? null : userBadge.id)}
                    title={t("setAsMain")}
                  >
                    <BadgeIcon iconUrl={def.icon_url} />
                    <BadgeInfo>
                      <BadgeName>{def.name}</BadgeName>
                      <BadgeDesc>{def.description}</BadgeDesc>
                    </BadgeInfo>
                    {isMain && <MainPill>{t("isMain")}</MainPill>}
                  </BadgeRow>
                );
              })}
            </>
          )}

          {/* 도전 중인 배지 */}
          {lockedBadges.length > 0 && (
            <>
              <SectionLabel>{t("lockedSection")}</SectionLabel>
              {lockedBadges.map((def) => (
                <LockedRow key={def.id}>
                  <BadgeIcon iconUrl={def.icon_url} locked />
                  <BadgeInfo>
                    <LockedName>{def.name}</LockedName>
                  </BadgeInfo>
                  <LockIcon>🔒</LockIcon>
                </LockedRow>
              ))}
            </>
          )}
        </Body>
      </Wrapper>

      {/* 대표 배지 선택 모달 */}
      {modalOpen && (
        <ModalOverlay onClick={() => setModalOpen(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{t("selectModalTitle")}</ModalTitle>
              <ModalCloseBtn onClick={() => setModalOpen(false)}>
                ✕
              </ModalCloseBtn>
            </ModalHeader>

            {regularBadges.map((userBadge, idx) => {
              const def = userBadge.badge_definitions as BadgeDefinition;
              const isSelected = userBadge.id === data.main_badge_id;
              return (
                <div key={userBadge.id}>
                  {idx > 0 && <ModalDivider />}
                  <ModalOptionRow
                    $selected={isSelected}
                    onClick={() => setMainBadge(userBadge.id)}
                  >
                    <BadgeIcon iconUrl={def.icon_url} />
                    <BadgeInfo>
                      <BadgeName>{def.name}</BadgeName>
                      <BadgeDesc>{def.description}</BadgeDesc>
                    </BadgeInfo>
                    <RadioOuter $selected={isSelected}>
                      {isSelected && <RadioInner />}
                    </RadioOuter>
                  </ModalOptionRow>
                </div>
              );
            })}

            {data.main_badge_id && (
              <RemoveMainBtn onClick={() => setMainBadge(null)}>
                {t("removeMain")}
              </RemoveMainBtn>
            )}
          </ModalCard>
        </ModalOverlay>
      )}
    </>
  );
}
