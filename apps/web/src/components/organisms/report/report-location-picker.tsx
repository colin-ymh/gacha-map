"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import { PRIMARY } from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.white};
`;

const Header = styled.div`
  height: 52px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0 16px;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.gray700};
  line-height: 1;
  padding: 0;
  margin-right: 8px;
`;

const HeaderTitle = styled.span`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray900};
`;

const MapWrapper = styled.div`
  flex: 1;
  position: relative;
`;

const MapDiv = styled.div`
  width: 100%;
  height: 100%;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.gray100};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
`;

const Crosshair = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;
`;

const CrosshairVertical = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 28px;
  background: ${PRIMARY};
  border-radius: 1px;
`;

const CrosshairHorizontal = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 2px;
  background: ${PRIMARY};
  border-radius: 1px;
`;

const CrosshairDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.white};
  border: 2px solid ${PRIMARY};
`;

const BottomPanel = styled.div`
  padding: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
`;

const AddressText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray700};
  text-align: center;
  margin: 0 0 12px;
  min-height: 20px;
`;

// ── Component ─────────────────────────────────────────────────────────────────

export type LocationPickerResult = {
  lat: number;
  lng: number;
  address: string | null;
};

interface ReportLocationPickerProps {
  onSelect: (result: LocationPickerResult) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any;
  }
}

const INITIAL = { lat: 37.5666, lng: 126.9784, zoom: 14 };

const ReportLocationPicker = ({
  onSelect,
  onClose,
}: ReportLocationPickerProps) => {
  const t = useTranslations("report");
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const latRef = useRef(INITIAL.lat);
  const lngRef = useRef(INITIAL.lng);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    setLoadingAddress(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = (await res.json()) as { address: string | null };
        setAddress(data.address);
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  useEffect(() => {
    if (window.naver?.maps) {
      queueMicrotask(() => setReady(true));
      return;
    }
    const interval = setInterval(() => {
      if (window.naver?.maps) {
        setReady(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ready || !mapDivRef.current || mapRef.current) return;

    const map = new window.naver.maps.Map(mapDivRef.current, {
      center: new window.naver.maps.LatLng(INITIAL.lat, INITIAL.lng),
      zoom: INITIAL.zoom,
    });
    mapRef.current = map;

    fetchAddress(INITIAL.lat, INITIAL.lng);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        latRef.current = latitude;
        lngRef.current = longitude;
        map.setCenter(new window.naver.maps.LatLng(latitude, longitude));
        fetchAddress(latitude, longitude);
      });
    }

    window.naver.maps.Event.addListener(map, "idle", () => {
      const center = map.getCenter();
      const lat = center.lat();
      const lng = center.lng();
      latRef.current = lat;
      lngRef.current = lng;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchAddress(lat, lng);
      }, 400);
    });
  }, [ready, fetchAddress]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelect = useCallback(() => {
    onSelect({ lat: latRef.current, lng: lngRef.current, address });
  }, [address, onSelect]);

  return (
    <Overlay>
      <Header>
        <CloseButton onClick={onClose} aria-label="닫기">
          ‹
        </CloseButton>
        <HeaderTitle>{t("locationLabel")}</HeaderTitle>
      </Header>

      <MapWrapper>
        <MapDiv ref={mapDivRef} />
        {!ready && <LoadingOverlay>{t("loadingAddress")}</LoadingOverlay>}
        <Crosshair>
          <CrosshairVertical />
          <CrosshairHorizontal />
          <CrosshairDot />
        </Crosshair>
      </MapWrapper>

      <BottomPanel>
        <AddressText>
          {loadingAddress
            ? t("loadingAddress")
            : (address ?? t("unknownAddress"))}
        </AddressText>
        <Button type="button" fullWidth onClick={handleSelect}>
          {t("selectThisLocation")}
        </Button>
      </BottomPanel>
    </Overlay>
  );
};

export default ReportLocationPicker;
