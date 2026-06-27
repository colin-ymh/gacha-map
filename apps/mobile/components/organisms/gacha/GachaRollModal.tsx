import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "./GachaRollModal.view";

interface Props {
  visible: boolean;
  productId: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onLoginRequired: () => void;
}

const GachaRollModal = ({
  visible,
  productId,
  isLoggedIn,
  onClose,
  onLoginRequired,
}: Props) => {
  const { variants, status, result, nextAvailableAt, errorMessage, roll } =
    useGachaRoll(productId);

  return (
    <GachaRollModalView
      visible={visible}
      status={status}
      variants={variants}
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
