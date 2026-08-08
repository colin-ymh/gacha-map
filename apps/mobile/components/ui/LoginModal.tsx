import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { GlassModal, GlassModalButton } from "@/components/ui/GlassModal";
import { TEXT_DARK, TEXT_GRAY } from "@/constants/colors";

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginPress: () => void;
}

export default function LoginModal({
  visible,
  onClose,
  onLoginPress,
}: LoginModalProps) {
  const { t } = useTranslation();
  return (
    <GlassModal visible={visible} onRequestClose={onClose} maxWidth={280}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: TEXT_DARK,
          marginBottom: 8,
        }}
      >
        {t("login.required")}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: TEXT_GRAY,
          textAlign: "center",
          marginBottom: 20,
          lineHeight: 20,
        }}
      >
        {t("login.requiredDesc")}
      </Text>

      <GlassModalButton
        label={t("login.loginBtn")}
        onPress={onLoginPress}
        style={{ marginBottom: 10 }}
      />
      <GlassModalButton
        label={t("login.cancel")}
        onPress={onClose}
        variant="neutral"
      />
    </GlassModal>
  );
}
