import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import { useDailyQuota } from "@/hooks/useDailyQuota";
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
  const nickname = useAppSelector((s) => s.auth.profile?.nickname ?? null);
  // 공유 링크에 붙일 초대 코드.
  const referralCode = useAppSelector(
    (s) => s.auth.profile?.referral_code ?? null,
  );
  const { quota, refetch: refetchQuota } = useDailyQuota(!!isLoggedIn);

  const [productImageUrl, setProductImageUrl] = useState<string | null>(
    paramImageUrl ? decodeURIComponent(paramImageUrl) : null,
  );

  const { status, result, nextAvailableAt, dailyLimitTotal, limitHitCount, errorMessage, roll } = useGachaRoll(
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
        const url = data?.product?.official_image_url ?? null;
        if (url) setProductImageUrl(url);
      })
      .catch(() => {});
  }, [id, productImageUrl]);

  useEffect(() => {
    if (status === "result" && result) {
      setRollStats(result.stats);
      // 결과를 닫고 idle 화면으로 돌아왔을 때 잔여 횟수가 낡은 값으로 남지 않게 한다.
      void refetchQuota();
    }
  }, [status, result, setRollStats, refetchQuota]);

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
      referralCode={referralCode}
      dailyLimitTotal={dailyLimitTotal}
      limitHitCount={limitHitCount}
      quota={quota}
      nickname={nickname}
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
