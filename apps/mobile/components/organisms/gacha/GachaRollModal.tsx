import { useEffect, useState, type ReactNode } from "react";
import { useAppSelector } from "@/store/hooks";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import { useGachaRollStats } from "@/hooks/useGachaRollStats";
import GachaRollModalView from "./GachaRollModal.view";
import GachaRollRecordsModal from "./GachaRollRecordsModal";
import type { GachaRollQuotaSummary, GachaRollResult } from "@gacha-map/shared";

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
  /** 오늘의 뽑기 쿼터. 화면이 이미 roll-status로 받아둔 값을 그대로 전달한다. */
  quota: GachaRollQuotaSummary | null;
  /** 뽑기 직후 쿼터를 다시 받아오는 콜백. 화면의 roll-status를 재조회한다. */
  onRefetchQuota: () => void;
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
  quota,
  onRefetchQuota,
}: Props) => {
  // 공유 링크에 붙일 초대 코드. 로그인하지 않았거나 프로필 조회에 실패하면 null이다.
  const referralCode = useAppSelector(
    (s) => s.auth.profile?.referral_code ?? null,
  );
  const {
    status,
    result,
    nextAvailableAt,
    dailyLimitTotal,
    limitHitCount,
    errorMessage,
    roll,
  } = useGachaRoll(productId);
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
      onRefetchQuota();
    }
  }, [status, result, onRolled, setRollStats, onRefetchQuota]);

  return (
    <GachaRollModalView
      status={status}
      result={result}
      nextAvailableAt={nextAvailableAt}
      errorMessage={errorMessage}
      isLoggedIn={isLoggedIn}
      referralCode={referralCode}
      dailyLimitTotal={dailyLimitTotal}
      limitHitCount={limitHitCount}
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
