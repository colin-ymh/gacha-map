import { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { PressableScale } from "@/components/ui/PressableScale";
import { GlassModal, GlassModalButton } from "@/components/ui/GlassModal";
import { getAuthHeaders } from "@/lib/supabase";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  TEXT_DARK,
  TEXT_PLACEHOLDER,
  GRAY_200,
  WHITE,
  DANGER_BRIGHT,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const REASONS = ["spam", "abusive", "irrelevant", "fake", "other"] as const;
type ReviewReportReason = (typeof REASONS)[number];

interface ReviewReportModalProps {
  visible: boolean;
  reviewId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewReportModal({
  visible,
  reviewId,
  onClose,
  onSubmitted,
}: ReviewReportModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tR = (key: string) => t(`shopOwner.reviews.${key}`);

  const reasonLabel = (r: ReviewReportReason) => {
    const map: Record<ReviewReportReason, string> = {
      spam: tR("reportReasonSpam"),
      abusive: tR("reportReasonAbusive"),
      irrelevant: tR("reportReasonIrrelevant"),
      fake: tR("reportReasonFake"),
      other: tR("reportReasonOther"),
    };
    return map[r];
  };

  const detailValid = detail.trim().length >= 10 && detail.trim().length <= 500;
  const canSubmit =
    reason !== null && (reason !== "other" || detailValid) && !isSubmitting;

  const reset = () => {
    setReason(null);
    setDetail("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reviewId || !canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/api/shop-owner/reviews/${reviewId}/report`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            reason,
            reason_detail: reason === "other" ? detail.trim() : undefined,
          }),
        },
      );
      if (!res.ok) throw new Error();
      reset();
      onSubmitted();
    } catch {
      setError(tR("reportError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassModal visible={visible} onRequestClose={handleClose} maxWidth={340}>
      <View style={{ width: "100%", gap: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT_DARK }}>
          {tR("reportTitle")}
        </Text>

        <View style={{ gap: 8 }}>
          {REASONS.map((r) => {
            const selected = reason === r;
            return (
              <PressableScale
                key={r}
                onPress={() => setReason(r)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? PRIMARY : GRAY_200,
                  backgroundColor: selected ? PRIMARY_BG_SOFT : WHITE,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: selected ? "700" : "400",
                    color: selected ? PRIMARY : TEXT_DARK,
                  }}
                >
                  {reasonLabel(r)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {reason === "other" && (
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: GRAY_200,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: TEXT_DARK,
              minHeight: 80,
              textAlignVertical: "top",
            }}
            value={detail}
            onChangeText={setDetail}
            placeholder={tR("reportDetailPlaceholder")}
            placeholderTextColor={TEXT_PLACEHOLDER}
            multiline
            maxLength={500}
          />
        )}

        {error && (
          <Text style={{ fontSize: 13, color: DANGER_BRIGHT }}>{error}</Text>
        )}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <GlassModalButton
            label={tR("reportCancel")}
            onPress={handleClose}
            variant="neutral"
            disabled={isSubmitting}
            style={{ width: undefined, flex: 1 }}
          />
          <GlassModalButton
            label={isSubmitting ? tR("reportSubmitting") : tR("reportSubmit")}
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={{ width: undefined, flex: 1, opacity: canSubmit ? 1 : 0.5 }}
          />
        </View>
      </View>
    </GlassModal>
  );
}
