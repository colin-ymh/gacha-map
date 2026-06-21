import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY, TEXT_DARK, TEXT_GRAY, WHITE } from "@/constants/colors";

type LoginFeature = "wish" | "review" | "application";

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginPress: () => void;
  feature?: LoginFeature;
}

const FEATURE_KEYS: Record<
  LoginFeature,
  { icon: string; title: string; desc: string }
> = {
  wish: {
    icon: "heart",
    title: "login.wishRequired",
    desc: "login.wishRequiredDesc",
  },
  review: {
    icon: "create",
    title: "login.reviewRequired",
    desc: "login.reviewRequiredDesc",
  },
  application: {
    icon: "document-text",
    title: "login.applicationRequired",
    desc: "login.applicationRequiredDesc",
  },
};

export default function LoginModal({
  visible,
  onClose,
  onLoginPress,
  feature = "wish",
}: LoginModalProps) {
  const { t } = useTranslation();
  const keys = FEATURE_KEYS[feature];
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
          <Ionicons
            name={keys.icon as never}
            size={36}
            color={PRIMARY}
            style={{ marginBottom: 12 }}
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: TEXT_DARK,
              marginBottom: 8,
            }}
          >
            {t(keys.title)}
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
            {t(keys.desc)}
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
              {t("login.wishLoginBtn")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={onClose}>
            <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
              {t("login.wishCancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}
