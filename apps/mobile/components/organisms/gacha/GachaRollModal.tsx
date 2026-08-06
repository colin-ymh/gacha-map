import { useEffect, useState, type ReactNode } from "react";
import { useAppSelector } from "@/store/hooks";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import { useDailyQuota } from "@/hooks/useDailyQuota";
import { useGachaRollStats } from "@/hooks/useGachaRollStats";
import GachaRollModalView from "./GachaRollModal.view";
import GachaRollRecordsModal from "./GachaRollRecordsModal";
import type { GachaRollResult } from "@gacha-map/shared";

interface Props {
  productId: string;
  productName?: string;
  productImageUrl?: string | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onLoginRequired: () => void;
  onRolled?: (result: GachaRollResult) => void;
  onChangeGacha?: () => void;
  changeGachaOverlay?: ReactNode;
  asScreen?: boolean;
}

const GachaRollModal = ({
  productId,
  productName,
  productImageUrl,
  isLoggedIn,
  onClose,
  onLoginRequired,
  onRolled,
  onChangeGacha,
  changeGachaOverlay,
  asScreen,
}: Props) => {
  // 공유 링크에 붙일 초대 코드. 로그인하지 않았거나 프로필 조회에 실패하면 null이다.
  const referralCode = useAppSelector((s) => s.auth.profile?.referral_code ?? null);
  const { quota, refetch: refetchQuota } = useDailyQuota(!!isLoggedIn);
  const { status, result, nextAvailableAt, dailyLimitTotal, errorMessage, roll } =
    useGachaRoll(productId);
  const { stats: rollStats, setStats: setRollStats } = useGachaRollStats(
    productId,
    isLoggedIn,
  );
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    if (status === "result" && result) {
      setRollStats(result.stats);
      onRolled?.(result);
      // 결과를 닫고 idle 화면으로 돌아왔을 때 잔여 횟수가 낡은 값으로 남지 않게 한다.
      void refetchQuota();
    }
  }, [status, result, onRolled, setRollStats, refetchQuota]);

  return (
    <GachaRollModalView
      status={status}
      result={result}
      nextAvailableAt={nextAvailableAt}
      errorMessage={errorMessage}
      isLoggedIn={isLoggedIn}
      referralCode={referralCode}
      dailyLimitTotal={dailyLimitTotal}
      quota={quota}
      productName={productName}
      productImageUrl={productImageUrl}
      onRoll={roll}
      onClose={onClose}
      onLoginRequired={onLoginRequired}
      onChangeGacha={onChangeGacha}
      onRecordsPress={() => setRecordsOpen(true)}
      asScreen={asScreen}
      overlay={
        <>
          <GachaRollRecordsModal
            visible={recordsOpen}
            rollStats={rollStats}
            onClose={() => setRecordsOpen(false)}
          />
          {changeGachaOverlay}
        </>
      }
    />
  );
};

export default GachaRollModal;
