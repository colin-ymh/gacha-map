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
}

export default function QuickReportButtons({
  locationEnabled,
  alreadyReported,
  submitting,
  onReport,
}: QuickReportButtonsProps) {
  const { t } = useTranslation();
  const disabled = !locationEnabled || alreadyReported || submitting;

  if (alreadyReported) return null;

  const title = t("gacha.quickReport.emptyTitle");
  const subtitle = t("gacha.quickReport.emptySubtitle");

  return (
    <View style={styles.wrapper}>
      <View style={styles.expanded}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {!locationEnabled && (
          <Text style={styles.notice}>{t("gacha.quickReport.disabled")}</Text>
        )}

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: WHITE,
  },
  expanded: {
    padding: 24,
    alignItems: "center",
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
});
