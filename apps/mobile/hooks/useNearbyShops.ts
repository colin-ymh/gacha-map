import { useState, useEffect } from "react";
import * as Location from "expo-location";
import { useAppSelector } from "@/store/hooks";
import type { ShopSummary } from "@gacha-map/shared";


const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const NEARBY_RADIUS_KM = 10;
const DEG_PER_KM_LAT = 1 / 111;

function boundingBox(lat: number, lng: number, km: number) {
  const dLat = km * DEG_PER_KM_LAT;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    swLat: lat - dLat,
    swLng: lng - dLng,
    neLat: lat + dLat,
    neLng: lng + dLng,
  };
}

export interface UseNearbyShopsResult {
  shops: ShopSummary[];
  loading: boolean;
  locationDenied: boolean;
  userLat: number | null;
  userLng: number | null;
}

export function useNearbyShops(limit = 10): UseNearbyShopsResult {
  const userLocation = useAppSelector((s) => s.shops.userLocation);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [resolvedLat, setResolvedLat] = useState<number | null>(null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      let lat: number | null = userLocation?.lat ?? null;
      let lng: number | null = userLocation?.lng ?? null;

      if (lat == null || lng == null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) {
            setLocationDenied(true);
            setLoading(false);
          }
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      if (!cancelled) {
        setResolvedLat(lat);
        setResolvedLng(lng);
      }

      const box = boundingBox(lat, lng, NEARBY_RADIUS_KM);
      const params = new URLSearchParams({
        swLat: String(box.swLat),
        swLng: String(box.swLng),
        neLat: String(box.neLat),
        neLng: String(box.neLng),
        lat: String(lat),
        lng: String(lng),
        sort: "distance",
        limit: String(limit),
      });

      try {
        const res = await fetch(`${API_BASE}/api/shops?${params}`);
        if (!res.ok) throw new Error("Failed to fetch nearby shops");
        const data = await res.json();
        if (!cancelled) setShops((data.shops ?? []) as ShopSummary[]);
      } catch {
        // 에러 시 빈 목록 유지
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userLocation, limit]);

  return { shops, loading, locationDenied, userLat: resolvedLat, userLng: resolvedLng };
}
