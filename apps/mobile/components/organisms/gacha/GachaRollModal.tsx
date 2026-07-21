import { useEffect, useState } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
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
  asScreen,
}: Props) => {
  const { status, result, nextAvailableAt, errorMessage, roll } =
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
    }
  }, [status, result, onRolled, setRollStats]);

  return (
    <>
      <GachaRollModalView
        status={status}
        result={result}
        nextAvailableAt={nextAvailableAt}
        errorMessage={errorMessage}
        isLoggedIn={isLoggedIn}
        productName={productName}
        productImageUrl={productImageUrl}
        rollStats={rollStats}
        onRoll={roll}
        onClose={onClose}
        onLoginRequired={onLoginRequired}
        onRecordsPress={() => setRecordsOpen(true)}
        asScreen={asScreen}
      />
      <GachaRollRecordsModal
        visible={recordsOpen}
        rollStats={rollStats}
        onClose={() => setRecordsOpen(false)}
      />
    </>
  );
};

export default GachaRollModal;
