import { useEffect } from "react";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "./GachaRollModal.view";
import type { GachaRollResult } from "@gacha-map/shared";

interface Props {
  productId: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onLoginRequired: () => void;
  onRolled?: (result: GachaRollResult) => void;
}

const GachaRollModal = ({
  productId,
  isLoggedIn,
  onClose,
  onLoginRequired,
  onRolled,
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
      onRoll={roll}
      onClose={onClose}
      onLoginRequired={onLoginRequired}
    />
  );
};

export default GachaRollModal;
