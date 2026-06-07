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
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  BORDER,
  WHITE,
  GRAY_200,
} from "@/constants/colors";

interface QuickReportButtonsProps {
  locationEnabled: boolean;
  alreadyReported: boolean;
  submitting: boolean;
  onReport: (kind: QuickReportKind) => void;
  contributionCount?: number | null;
}

export default function QuickReportButtons({
  locationEnabled,
  alreadyReported,
  submitting,
  onReport,
  contributionCount,
}: QuickReportButtonsProps) {
  const { t } = useTranslation();
  const disabled = !locationEnabled || alreadyReported || submitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("gacha.quickReport.emptyTitle")}</Text>
      <Text style={styles.subtitle}>
        {t("gacha.quickReport.emptySubtitle")}
      </Text>

      {!locationEnabled && !alreadyReported && (
        <Text style={styles.notice}>{t("gacha.quickReport.disabled")}</Text>
      )}

      {alreadyReported ? (
        <>
          <Text style={styles.doneText}>
            {t("gacha.quickReport.alreadyReported")}
          </Text>
          {contributionCount != null && (
            <Text style={styles.countText}>
              {t("gacha.quickReport.reportCount", { count: contributionCount })}
            </Text>
          )}
        </>
      ) : (
        <View style={styles.buttonCol}>
          {submitting ? (
            <ActivityIndicator color={PRIMARY} />
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.presentBtn,
                  disabled && styles.presentBtnDisabled,
                ]}
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
  container: {
    padding: 24,
    alignItems: "center",
    backgroundColor: WHITE,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginBottom: 20,
    textAlign: "center",
  },
  notice: { fontSize: 12, color: TEXT_GRAY, marginBottom: 16 },
  doneText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
    marginBottom: 8,
  },
  countText: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginBottom: 16,
  },
  buttonCol: { width: "100%", gap: 8, marginBottom: 12 },
  presentBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  presentBtnDisabled: { backgroundColor: GRAY_200 },
  presentText: { color: WHITE, fontSize: 13, fontWeight: "700" },
  absentBtn: {
    backgroundColor: WHITE,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
    width: "100%",
    alignItems: "center",
  },
  absentBtnDisabled: { backgroundColor: GRAY_200, borderColor: GRAY_200 },
  absentText: { color: TEXT_GRAY, fontSize: 13 },
  absentTextDisabled: { color: TEXT_PLACEHOLDER },
  hint: { fontSize: 11, color: TEXT_PLACEHOLDER, textAlign: "center" },
});
