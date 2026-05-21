import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
            name="heart"
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
            로그인이 필요해요
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
            {"찜하기 기능을 사용하려면\n로그인이 필요합니다."}
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
              로그인하기
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={onClose}>
            <Text style={{ fontSize: 13, color: "#888888" }}>취소</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}
