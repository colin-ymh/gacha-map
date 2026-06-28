import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "./GachaRollModal.view";

interface Props {
  productId: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onLoginRequired: () => void;
}

const GachaRollModal = ({
  productId,
  isLoggedIn,
  onClose,
  onLoginRequired,
}: Props) => {
  const { status, result, nextAvailableAt, errorMessage, roll } =
    useGachaRoll(productId);

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
