import { Modal, View, Text, Pressable, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { shiftPendingBadge } from "@/store/slices/auth.slice";
import { supabase } from "@/lib/supabase";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  BLACK,
} from "@/constants/colors";

export default function BadgeEarnedModal() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const pending = useAppSelector((s) => s.auth.pendingBadgeNotifications);
  const badge = pending[0] ?? null;

  const handleDismiss = async () => {
    if (!badge) return;
    dispatch(shiftPendingBadge());
    if (supabase) {
      await supabase
        .from("user_badges")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", badge.id);
    }
  };

  if (!badge) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={handleDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: `${BLACK}80`,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <View
          style={{
            backgroundColor: WHITE,
            borderRadius: 20,
            padding: 32,
            alignItems: "center",
            width: "100%",
            maxWidth: 320,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: PRIMARY_BG,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            {badge.icon_url?.startsWith("http") ? (
              <Image
                source={{ uri: badge.icon_url }}
                style={{ width: 48, height: 48 }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: 40 }}>{badge.icon_url || "🏅"}</Text>
            )}
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: TEXT_DARK,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {t("badgeEarned.title")}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: TEXT_GRAY,
              marginBottom: 24,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {t("badgeEarned.message", { name: badge.name })}
          </Text>

          <Pressable
            onPress={handleDismiss}
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 32,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: WHITE }}>
              {t("badgeEarned.close")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
