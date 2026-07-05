import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { GachaRollResult } from "@gacha-map/shared";

import type { GachaRollStatus } from "@/hooks/useGachaRoll";
import {
  PRIMARY,
  PRIMARY_BG,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  BORDER,
} from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  status: GachaRollStatus;
  result: GachaRollResult | null;
  nextAvailableAt: string | null;
  errorMessage: string | null;
  isLoggedIn: boolean;
  onRoll: () => void;
  onClose: () => void;
  onLoginRequired: () => void;
}

// Manual locale formatting — avoids Hermes ICU limitation (month:"long" can
// return blank/en fallback for ko/ja/zh on Android Hermes without full ICU).
function formatNextAvailableAt(isoString: string, locale: string): string {
  const d = new Date(isoString);
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  if (locale.startsWith("ko")) return `${mo}월 ${day}일 ${time}`;
  if (locale.startsWith("ja") || locale.startsWith("zh")) return `${mo}月${day}日 ${time}`;
  return `${mo}/${day} ${time}`;
}

// ─── Ball specs with 3D light/shadow colors ───
const BALL_SPECS = [
  { light: "#FF8EBD", base: PRIMARY,    dark: "#C0306D" },
  { light: "#FF9E9E", base: "#FF6B6B",  dark: "#D44040" },
  { light: "#80D982", base: "#4CAF50",  dark: "#2E7D32" },
  { light: "#64B5F6", base: "#2196F3",  dark: "#1565C0" },
  { light: "#FFCC80", base: "#FF9800",  dark: "#E65100" },
  { light: "#CE93D8", base: "#9C27B0",  dark: "#6A1B9A" },
  { light: "#FF9EE0", base: "#FF6BCC",  dark: "#D440A0" },
  { light: "#80DEEA", base: "#00BCD4",  dark: "#00838F" },
  { light: "#FFF176", base: "#FFD600",  dark: "#C7A500" },
  { light: "#CFD8DC", base: "#78909C",  dark: "#455A64" },
];

const BALL_POSITIONS: Array<{ top: number; left: number; size: number }> = [
  { top: 10,  left: 40,  size: 52 },
  { top: 6,   left: 100, size: 46 },
  { top: 12,  left: 156, size: 48 },
  { top: 62,  left: 18,  size: 46 },
  { top: 56,  left: 76,  size: 56 },
  { top: 58,  left: 144, size: 46 },
  { top: 108, left: 38,  size: 50 },
  { top: 112, left: 100, size: 44 },
  { top: 104, left: 158, size: 46 },
  { top: 158, left: 72,  size: 42 },
];

function GradientBall({
  spec,
  size,
  style,
}: {
  spec: typeof BALL_SPECS[0];
  size: number;
  style?: object;
}) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: "hidden" },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.base }]} />
      <View
        style={{
          position: "absolute",
          top: "10%",
          left: "14%",
          width: "32%",
          height: "26%",
          borderRadius: 99,
          backgroundColor: "rgba(255,255,255,0.55)",
        }}
      />
    </View>
  );
}

function FloatingBalls() {
  const anims = useRef(BALL_SPECS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(anim, {
            toValue: -8,
            duration: 900 + i * 50,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 900 + i * 50,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <>
      {BALL_SPECS.map((spec, i) => {
        const pos = BALL_POSITIONS[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              transform: [{ translateY: anims[i] }],
            }}
          >
            <GradientBall spec={spec} size={pos.size} />
          </Animated.View>
        );
      })}
    </>
  );
}

// ─── Gacha Machine Illustration ───
function GachaMachine() {
  return (
    <View style={styles.machineWrap}>
      <View style={styles.dome}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.25)" }]} />
        <FloatingBalls />
      </View>

      <View style={[styles.neck, { backgroundColor: "#3A3A46" }]} />

      <View style={[styles.machineBase, { backgroundColor: "#2A2A34" }]}>
        <View style={[styles.machinePanel, { backgroundColor: "#2E2E38" }]}>
          <View style={[styles.knobWrap, { backgroundColor: PRIMARY }]}>
            <View style={styles.knobHighlight} />
          </View>
        </View>
        <View style={styles.slotOuter}>
          <View style={styles.slotInner} />
        </View>
      </View>
    </View>
  );
}

// ─── Cycling icon (animating state) ───
const CYCLE_ICONS = ["🎲","🎁","⭐","💎","🎪","🎠","🎯","🎊","🎀","🏆","🎡","🎨"];
const ANIMATION_TOTAL_MS = 2400;

function CyclingIcon() {
  const [iconIndex, setIconIndex] = useState(0);
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let elapsed = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const getDelay = (t: number) => (t < 1200 ? 110 : t < 1800 ? 220 : 480);

    const tick = () => {
      if (elapsed >= ANIMATION_TOTAL_MS) return;
      const delay = getDelay(elapsed);
      elapsed += delay;
      setIconIndex((p) => (p + 1) % CYCLE_ICONS.length);
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.3, duration: 55, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      timeout = setTimeout(tick, delay);
    };

    timeout = setTimeout(tick, 110);
    return () => clearTimeout(timeout);
  }, [iconScale]);

  return (
    <View style={styles.cyclingWrap}>
      <Text style={styles.sparkle1}>✦</Text>
      <Text style={styles.sparkle2}>✦</Text>
      <Text style={styles.sparkle3}>✦</Text>
      <Animated.View style={[styles.cyclingCircle, { transform: [{ scale: iconScale }] }]}>
        <Text style={styles.cyclingEmoji}>{CYCLE_ICONS[iconIndex]}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Result card ───
function ResultCard({ result }: { result: GachaRollResult }) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }).start();
  }, [scale]);

  const variant = result.variant;
  const displayName = variant.name_ko ?? variant.name;

  return (
    <Animated.View style={[styles.resultCard, { transform: [{ scale }] }]}>
      {variant.image_url ? (
        <Image source={{ uri: variant.image_url }} style={styles.resultImage} />
      ) : (
        <View style={styles.resultImagePlaceholder}>
          <Text style={styles.placeholderEmoji}>🎰</Text>
        </View>
      )}
      <View style={styles.resultLabelWrap}>
        <Text style={styles.resultLabel}>{t("gacha.roll.resultLabel")}</Text>
      </View>
      <Text style={styles.resultName} numberOfLines={2}>{displayName}</Text>
      {variant.name_ko && (
        <Text style={styles.resultSubName} numberOfLines={1}>{variant.name}</Text>
      )}
    </Animated.View>
  );
}

// ─── Background color per state ───
function getBgColor(status: GachaRollStatus): string {
  if (status === "animating") return PRIMARY;
  if (status === "result") return WHITE;
  if (status === "idle") return PRIMARY_BG;
  return GRAY_100;
}

// ─── Main view ───
const GachaRollModalView = ({
  status,
  result,
  nextAvailableAt,
  errorMessage,
  isLoggedIn,
  onRoll,
  onClose,
  onLoginRequired,
}: Props) => {
  const { t, i18n } = useTranslation();

  const handleRollPress = () => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    onRoll();
  };

  const isAnimating = status === "animating";
  const bgColor = getBgColor(status);

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={isAnimating ? undefined : onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>

        {/* Header row with close button */}
        <View style={styles.header}>
          {!isAnimating && (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t("gacha.roll.close")}
            >
              <View style={styles.closeBtnCircle}>
                <Ionicons name="close" size={20} color={TEXT_GRAY} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── LOADING VARIANTS ── */}
        {status === "loading_variants" && (
          <View style={styles.centerFlex}>
            <ActivityIndicator color={PRIMARY} size="large" />
          </View>
        )}

        {/* ── IDLE ── */}
        {status === "idle" && (
          <View style={styles.idleWrap}>
            <Text style={styles.idleTitle}>{t("gacha.roll.title")}</Text>
            <Text style={styles.idleSubtitle}>{t("gacha.roll.subtitle")}</Text>
            <View style={styles.machineContainer}>
              <GachaMachine />
            </View>
          </View>
        )}

        {/* ── ANIMATING ── */}
        {status === "animating" && (
          <View style={styles.animWrap}>
            <Text style={styles.animTitle}>{t("gacha.roll.animTitle")}</Text>
            <Text style={styles.animSubtitle}>{t("gacha.roll.animSubtitle")}</Text>
            <CyclingIcon />
            <View style={styles.animDots}>
              <View style={[styles.animDot, { opacity: 1 }]} />
              <View style={[styles.animDot, { opacity: 0.5 }]} />
              <View style={[styles.animDot, { opacity: 0.25 }]} />
            </View>
            <Text style={styles.animWait}>{t("gacha.roll.animWait")}</Text>
          </View>
        )}

        {/* ── RESULT ── */}
        {status === "result" && result && (
          <View style={styles.resultWrap}>
            <Text style={styles.resultTitle}>{t("gacha.roll.resultTitle")}</Text>
            <Text style={styles.resultSubtitle}>
              {result.permission.remainingToday > 0
                ? t("gacha.roll.resultRemainingMany", { count: result.permission.remainingToday })
                : t("gacha.roll.resultRemainingNone")}
            </Text>
            <ResultCard result={result} />
            <Text style={styles.resultNextAtOutside}>
              {t("gacha.roll.resultNextAt", {
                time: formatNextAvailableAt(result.permission.nextAvailableAt, i18n.language),
              })}
            </Text>
          </View>
        )}

        {/* ── ALREADY ROLLED ── */}
        {status === "already_rolled" && (
          <View style={styles.centerFlex}>
            <Ionicons name="time-outline" size={32} color={TEXT_GRAY} />
            <Text style={styles.stateTitle}>{t("gacha.roll.alreadyRolledTitle")}</Text>
            <Text style={styles.stateSubtitle}>{t("gacha.roll.alreadyRolledSubtitle")}</Text>
            {nextAvailableAt && (
              <View style={styles.nextAtCard}>
                <Text style={styles.nextAtLabel}>{t("gacha.roll.nextRollLabel")}</Text>
                <Text style={styles.nextAtValue}>{formatNextAvailableAt(nextAvailableAt, i18n.language)}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── DAILY LIMIT ── */}
        {status === "daily_limit" && (
          <View style={styles.centerFlex}>
            <Ionicons name="checkmark-circle-outline" size={32} color={TEXT_GRAY} />
            <Text style={styles.stateTitle}>{t("gacha.roll.dailyLimitTitle")}</Text>
            <Text style={styles.stateSubtitle}>{t("gacha.roll.dailyLimitSubtitle")}</Text>
            {nextAvailableAt && (
              <View style={styles.nextAtCard}>
                <Text style={styles.nextAtLabel}>{t("gacha.roll.nextRollTomorrowLabel")}</Text>
                <Text style={styles.nextAtValue}>{formatNextAvailableAt(nextAvailableAt, i18n.language)}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── NO VARIANTS ── */}
        {status === "no_variants" && (
          <View style={styles.centerFlex}>
            <Ionicons name="help-circle-outline" size={32} color={TEXT_GRAY} />
            <Text style={styles.stateTitle}>{t("gacha.roll.noVariantsTitle")}</Text>
            <Text style={styles.stateSubtitle}>{t("gacha.roll.noVariantsSubtitle")}</Text>
          </View>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <View style={styles.centerFlex}>
            <Ionicons name="alert-circle-outline" size={32} color={TEXT_GRAY} />
            <Text style={styles.stateTitle}>{t("gacha.roll.errorTitle")}</Text>
            <Text style={styles.stateSubtitle}>{errorMessage ?? t("gacha.roll.errorSubtitle")}</Text>
          </View>
        )}

        {/* ── Bottom CTA ── */}
        {!isAnimating && (
          <View style={styles.bottomSection}>
            {status === "idle" && (
              <>
                <TouchableOpacity style={styles.ctaBtn} onPress={handleRollPress}>
                  <Text style={styles.ctaBtnText}>{t("gacha.roll.rollStart")}</Text>
                </TouchableOpacity>
                <Text style={styles.bottomNote}>{t("gacha.roll.rollNote")}</Text>
              </>
            )}
            {status === "result" && (
              <TouchableOpacity
                onPress={onClose}
                style={{ alignItems: "center", paddingVertical: 12 }}
              >
                <Text style={{ fontSize: 15, color: TEXT_GRAY }}>{t("gacha.roll.close")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default GachaRollModalView;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // ─── Header row ───
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 52,
    alignItems: "center",
  },
  closeBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── IDLE ───
  idleWrap: {
    flex: 1,
    paddingTop: 16,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  idleTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  idleSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
    marginTop: 10,
  },
  machineContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Machine
  machineWrap: {
    alignItems: "center",
  },
  dome: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(200,205,230,0.8)",
    backgroundColor: "#EEF0FF",
  },
  neck: {
    width: 72,
    height: 18,
    borderRadius: 5,
    overflow: "hidden",
  },
  machineBase: {
    width: 160,
    height: 120,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 12,
    gap: 8,
  },
  machinePanel: {
    width: 128,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  knobWrap: {
    width: 60,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  knobHighlight: {
    position: "absolute",
    top: "10%",
    left: "15%",
    width: "38%",
    height: "32%",
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  slotOuter: {
    width: 80,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111119",
    alignItems: "center",
    justifyContent: "center",
  },
  slotInner: {
    width: 64,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#0A0A10",
  },

  // ─── ANIMATING ───
  animWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 24,
  },
  animTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: WHITE,
  },
  animSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
    marginBottom: 32,
  },
  cyclingWrap: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cyclingCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cyclingEmoji: {
    fontSize: 80,
  },
  sparkle1: { position: "absolute", top: 18, left: 8, fontSize: 24, color: WHITE },
  sparkle2: { position: "absolute", top: 28, right: 4, fontSize: 18, color: WHITE },
  sparkle3: { position: "absolute", bottom: 24, right: 12, fontSize: 14, color: WHITE },
  animDots: {
    flexDirection: "row",
    gap: 10,
    marginTop: 36,
  },
  animDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: WHITE,
  },
  animWait: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 16,
  },

  // ─── RESULT ───
  resultWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  resultSubtitle: {
    fontSize: 15,
    color: TEXT_GRAY,
    marginTop: 6,
    marginBottom: 24,
  },
  resultCard: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: WHITE,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  resultImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: PRIMARY_BG,
  },
  resultImagePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: PRIMARY_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 60 },
  resultLabelWrap: {
    backgroundColor: PRIMARY_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  resultLabel: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  resultName: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  resultSubName: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  resultNextAtOutside: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
    marginTop: 16,
  },

  // ─── COMMON STATES ───
  centerFlex: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  stateSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
    lineHeight: 22,
  },
  nextAtCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    marginTop: 16,
    alignItems: "center",
    gap: 6,
  },
  nextAtLabel: { fontSize: 12, color: TEXT_GRAY },
  nextAtValue: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },

  // ─── BOTTOM ───
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 12,
    gap: 10,
  },
  ctaBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: WHITE },
  bottomNote: { fontSize: 12, color: TEXT_GRAY, textAlign: "center" },
});
