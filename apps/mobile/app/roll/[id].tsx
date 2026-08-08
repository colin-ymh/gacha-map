import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "@/components/organisms/gacha/GachaRollModal.view";
import GachaRollRecordsModal from "@/components/organisms/gacha/GachaRollRecordsModal";
import GachaChangePickerModal from "@/components/organisms/gacha/GachaChangePickerModal";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  fetchDailyQuotaAsync,
  setQuota,
} from "@/store/slices/gachaQuota.slice";
import { useGachaRollStats } from "@/hooks/useGachaRollStats";
import LoginModal from "@/components/ui/LoginModal";
import type { GachaProductWithShops } from "@gacha-map/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function RollScreen() {
  const { id, imageUrl: paramImageUrl } = useLocalSearchParams<{
    id: string;
    imageUrl?: string;
  }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const nickname = useAppSelector((s) => s.auth.profile?.nickname ?? null);
  // 공유 링크에 붙일 초대 코드.
  const referralCode = useAppSelector(
    (s) => s.auth.profile?.referral_code ?? null,
  );
  // 로그인 시(_layout.tsx) 미리 받아둔 캐시를 즉시 보여주고, 화면 진입 시
  // 백그라운드로 다시 받아온다 — 매번 빈 화면에서 새로 기다리지 않는다.
  const quota = useAppSelector((s) => s.gachaQuota.quota);

  useEffect(() => {
    if (isLoggedIn) void dispatch(fetchDailyQuotaAsync());
  }, [isLoggedIn, dispatch]);

  const [productImageUrl, setProductImageUrl] = useState<string | null>(
    paramImageUrl ? decodeURIComponent(paramImageUrl) : null,
  );

  const {
    status,
    result,
    nextAvailableAt,
    dailyLimitTotal,
    limitHitCount,
    errorMessage,
    roll,
  } = useGachaRoll(id ?? "");
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
      // 결과를 닫고 idle 화면으로 돌아왔을 때 잔여 횟수가 낡은 값으로 남지 않게
      // 한다. 뽑기 응답에 이미 최신 쿼터가 실려오므로 재조회 없이 그대로 쓴다.
      dispatch(
        setQuota({
          base: result.permission.base,
          bonus: result.permission.bonus,
          used: result.permission.used,
          remaining: result.permission.remainingToday,
        }),
      );
    }
  }, [status, result, setRollStats, dispatch]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

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
      onLoginRequired={() => setShowLoginModal(true)}
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
          <LoginModal
            visible={showLoginModal}
            onClose={() => {
              setShowLoginModal(false);
              router.back();
            }}
            onLoginPress={() => {
              setShowLoginModal(false);
              router.back();
              router.push("/login" as never);
            }}
          />
        </>
      }
    />
  );
}
