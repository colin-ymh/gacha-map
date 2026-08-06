import { View, Text, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { GlassModal, GlassModalButton } from "@/components/ui/GlassModal";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { shiftPendingBadge } from "@/store/slices/auth.slice";
import { supabase } from "@/lib/supabase";
import { PRIMARY_BG, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";

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
    <GlassModal visible onRequestClose={handleDismiss}>
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

      <GlassModalButton
        label={t("badgeEarned.close")}
        onPress={handleDismiss}
      />
    </GlassModal>
  );
}
