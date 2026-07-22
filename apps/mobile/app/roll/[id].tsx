import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "@/components/organisms/gacha/GachaRollModal.view";
import GachaRollRecordsModal from "@/components/organisms/gacha/GachaRollRecordsModal";
import GachaChangePickerModal from "@/components/organisms/gacha/GachaChangePickerModal";
import { useAppSelector } from "@/store/hooks";
import { useGachaRollStats } from "@/hooks/useGachaRollStats";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function RollScreen() {
  const { id, imageUrl: paramImageUrl } = useLocalSearchParams<{
    id: string;
    imageUrl?: string;
  }>();
  const router = useRouter();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const [productImageUrl, setProductImageUrl] = useState<string | null>(
    paramImageUrl ? decodeURIComponent(paramImageUrl) : null,
  );

  const { status, result, nextAvailableAt, errorMessage, roll } = useGachaRoll(
    id ?? "",
  );
  const { stats: rollStats, setStats: setRollStats } = useGachaRollStats(
    id ?? "",
    !!isLoggedIn,
  );
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    if (productImageUrl || !id) return;
    fetch(`${API_BASE}/api/gacha-products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const url = data?.official_image_url ?? null;
        if (url) setProductImageUrl(url);
      })
      .catch(() => {});
  }, [id, productImageUrl]);

  useEffect(() => {
    if (status === "result" && result) {
      setRollStats(result.stats);
    }
  }, [status, result, setRollStats]);

  const [pickerOpen, setPickerOpen] = useState(false);

  const selectGacha = (item: GachaProductWithShops) => {
    setPickerOpen(false);
    const img = item.official_image_url;
    router.replace(
      `/roll/${item.id}${img ? `?imageUrl=${encodeURIComponent(img)}` : ""}` as never,
    );
  };

  return (
    <GachaRollModalView
      status={status}
      result={result}
      nextAvailableAt={nextAvailableAt}
      errorMessage={errorMessage}
      isLoggedIn={!!isLoggedIn}
      productImageUrl={productImageUrl}
      onRoll={roll}
      onClose={() => router.back()}
      onLoginRequired={() => {
        router.back();
        router.push("/login" as never);
      }}
      onChangeGacha={() => setPickerOpen(true)}
      onRecordsPress={() => setRecordsOpen(true)}
      asScreen
      overlay={
        <>
          <GachaRollRecordsModal
            visible={recordsOpen}
            rollStats={rollStats}
            onClose={() => setRecordsOpen(false)}
          />
          <GachaChangePickerModal
            visible={pickerOpen}
            currentId={id}
            onClose={() => setPickerOpen(false)}
            onSelect={selectGacha}
          />
        </>
      }
    />
  );
}
