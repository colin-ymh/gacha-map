import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { QuickReportKind } from "@gacha-map/shared";
import {
  PRIMARY,
  TEXT_SECONDARY,
  BORDER,
  WHITE,
  SUCCESS_GREEN,
} from "@/constants/colors";

interface QuickReportButtonsProps {
  locationEnabled: boolean;
  alreadyReported: boolean;
  submitting: boolean;
  onReport: (kind: QuickReportKind) => void;
}

export default function QuickReportButtons({
  locationEnabled,
  alreadyReported,
  submitting,
  onReport,
}: QuickReportButtonsProps) {
  const { t } = useTranslation();
  const disabled = !locationEnabled || alreadyReported || submitting;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎰</Text>
      <Text style={styles.title}>{t("gacha.quickReport.emptyTitle")}</Text>
      <Text style={styles.subtitle}>
        {t("gacha.quickReport.emptySubtitle")}
      </Text>

      {!locationEnabled && !alreadyReported && (
        <Text style={styles.notice}>{t("gacha.quickReport.disabled")}</Text>
      )}

      {alreadyReported ? (
        <Text style={styles.notice}>
          {t("gacha.quickReport.alreadyReported")}
        </Text>
      ) : (
        <View style={styles.buttonRow}>
          {submitting ? (
            <ActivityIndicator color={PRIMARY} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.presentBtn, disabled && styles.btnDisabled]}
                onPress={() => !disabled && onReport("gacha_present")}
                disabled={disabled}
              >
                <Text style={styles.presentText}>
                  {t("gacha.quickReport.present")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.absentBtn, disabled && styles.absentBtnDisabled]}
                onPress={() => !disabled && onReport("gacha_absent")}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.absentText,
                    disabled && styles.absentTextDisabled,
                  ]}
                >
                  {t("gacha.quickReport.absent")}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <Text style={styles.hint}>{t("gacha.quickReport.hint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: "center", backgroundColor: "#fafafa" },
  emoji: { fontSize: 32, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: "700", color: "#333", marginBottom: 4 },
  subtitle: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 20 },
  notice: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 16 },
  buttonRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  presentBtn: {
    backgroundColor: SUCCESS_GREEN,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  presentText: { color: WHITE, fontSize: 13, fontWeight: "700" },
  absentBtn: {
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  absentBtnDisabled: { backgroundColor: "#eee", borderColor: "#ddd" },
  absentText: { color: "#555", fontSize: 13 },
  absentTextDisabled: { color: "#aaa" },
  btnDisabled: { backgroundColor: "#ccc" },
  hint: { fontSize: 11, color: "#bbb" },
});
