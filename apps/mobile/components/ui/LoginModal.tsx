import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { PRIMARY, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";

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
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: WHITE,
            borderRadius: 16,
            padding: 24,
            width: 280,
            alignItems: "center",
          }}
        >
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
          <TouchableOpacity
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 10,
              paddingVertical: 12,
              width: "100%",
              alignItems: "center",
            }}
            onPress={onLoginPress}
          >
            <Text style={{ color: WHITE, fontSize: 15, fontWeight: "700" }}>
              {t("login.loginBtn")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={onClose}>
            <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
              {t("login.cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}
