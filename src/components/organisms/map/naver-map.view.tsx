"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";

// ── Styled ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

export const MapDiv = styled.div`
  width: 100%;
  height: 100%;
`;

const Loading = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.gray100};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
`;

const MyLocationButton = styled.button`
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 10;
  width: 44px;
  height: 44px;
  background: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: 50%;
  box-shadow: ${({ theme }) => theme.shadow.card};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: ${({ theme }) => theme.colors.primary};
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface NaverMapViewProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
  onMyLocation: () => void;
}

const NaverMapView = ({ mapRef, ready, onMyLocation }: NaverMapViewProps) => {
  const t = useTranslations("map");

  return (
    <Container>
      <MapDiv ref={mapRef} />
      {!ready && <Loading>{t("loading")}</Loading>}
      <MyLocationButton onClick={onMyLocation} aria-label={t("myLocation")}>
        ◎
      </MyLocationButton>
    </Container>
  );
};

export default NaverMapView;
