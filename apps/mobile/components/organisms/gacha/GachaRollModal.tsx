import { useEffect } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "./GachaRollModal.view";
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

  useEffect(() => {
    if (status === "result" && result && onRolled) {
      onRolled(result);
    }
  }, [status, result, onRolled]);

  return (
    <GachaRollModalView
      status={status}
      result={result}
      nextAvailableAt={nextAvailableAt}
      errorMessage={errorMessage}
      isLoggedIn={isLoggedIn}
      productName={productName}
      productImageUrl={productImageUrl}
      onRoll={roll}
      onClose={onClose}
      onLoginRequired={onLoginRequired}
      asScreen={asScreen}
    />
  );
};

export default GachaRollModal;
