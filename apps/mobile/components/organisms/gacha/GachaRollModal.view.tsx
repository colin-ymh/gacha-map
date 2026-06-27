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
import { LinearGradient } from "expo-linear-gradient";
import type { GachaProductVariant, GachaRollResult } from "@gacha-map/shared";
import type { GachaRollStatus } from "@/hooks/useGachaRoll";
import {
  PRIMARY,
  PRIMARY_BG,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_300,
  BORDER,
} from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  status: GachaRollStatus;
  variants: GachaProductVariant[];
  result: GachaRollResult | null;
  nextAvailableAt: string | null;
  errorMessage: string | null;
  isLoggedIn: boolean;
  onRoll: () => void;
  onClose: () => void;
  onLoginRequired: () => void;
}

function formatNextAvailableAt(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
];

const BALL_POSITIONS: Array<{ top: number; left: number; size: number }> = [
  { top: 28,  left: 55,  size: 54 },
  { top: 18,  left: 104, size: 48 },
  { top: 26,  left: 150, size: 52 },
  { top: 74,  left: 32,  size: 48 },
  { top: 68,  left: 84,  size: 56 },
  { top: 72,  left: 142, size: 46 },
  { top: 116, left: 62,  size: 50 },
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
      <LinearGradient
        colors={[spec.light, spec.base, spec.dark]}
        start={{ x: 0.2, y: 0.05 }}
        end={{ x: 0.85, y: 0.95 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Specular highlight */}
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
          Animated.delay(i * 180),
          Animated.timing(anim, {
            toValue: -9,
            duration: 950 + i * 55,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 950 + i * 55,
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
      {/* Glass dome */}
      <View style={styles.dome}>
        {/* Dome inner bg */}
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.85)",
            "rgba(240,242,255,0.5)",
            "rgba(220,225,255,0.2)",
          ]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <FloatingBalls />
        {/* Dome glass shine */}
        <LinearGradient
          colors={["rgba(255,255,255,0.45)", "transparent"]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.55, y: 0.55 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 110 }]}
        />
      </View>

      {/* Connector neck */}
      <View style={styles.neck}>
        <LinearGradient
          colors={["#4A4A55", "#2E2E38"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Machine base */}
      <View style={styles.machineBase}>
        <LinearGradient
          colors={["#3D3D48", "#2A2A34", "#1E1E28"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />
        {/* Front panel */}
        <View style={styles.machinePanel}>
          <LinearGradient
            colors={["#38383F", "#252530"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
          />
          {/* Knob/lever */}
          <View style={styles.knobWrap}>
            <LinearGradient
              colors={["#FF7AB5", PRIMARY, "#C93575"]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
            />
            <View style={styles.knobHighlight} />
          </View>
        </View>

        {/* Output slot */}
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
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }).start();
  }, [scale]);

  const variant = result.variant;
  const displayName = variant.name_ko ?? variant.name;
  const nextAt = formatNextAvailableAt(result.permission.nextAvailableAt);

  return (
    <Animated.View style={[styles.resultCard, { transform: [{ scale }] }]}>
      {variant.image_url ? (
        <Image source={{ uri: variant.image_url }} style={styles.resultImage} />
      ) : (
        <View style={styles.resultImagePlaceholder}>
          <Text style={styles.placeholderEmoji}>🎲</Text>
        </View>
      )}
      <View style={styles.resultLabelWrap}>
        <Text style={styles.resultLabel}>가챠 결과</Text>
      </View>
      <Text style={styles.resultName} numberOfLines={2}>{displayName}</Text>
      {variant.name_ko && (
        <Text style={styles.resultSubName} numberOfLines={1}>{variant.name}</Text>
      )}
      <View style={styles.resultDivider} />
      <Text style={styles.resultNextAt}>다음 뽑기: {nextAt}</Text>
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
  variants,
  result,
  nextAvailableAt,
  errorMessage,
  isLoggedIn,
  onRoll,
  onClose,
  onLoginRequired,
}: Props) => {
  const handleRollPress = () => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    onRoll();
  };

  const isAnimating = status === "animating";
  const bgColor = getBgColor(status);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>

        {/* Close button */}
        {!isAnimating && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.closeBtnCircle}>
              <Text style={styles.closeBtnText}>×</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── LOADING VARIANTS ── */}
        {status === "loading_variants" && (
          <View style={styles.centerFlex}>
            <ActivityIndicator color={PRIMARY} size="large" />
          </View>
        )}

        {/* ── IDLE ── */}
        {status === "idle" && (
          <View style={styles.idleWrap}>
            <Text style={styles.idleTitle}>오늘의 가챠 뽑기</Text>
            <Text style={styles.idleSubtitle}>어떤 상품이 뽑힐지 미리 확인해봐요!</Text>
            <View style={styles.machineContainer}>
              <GachaMachine />
            </View>
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>🎲 하루 1회 무료 뽑기</Text>
            </View>
          </View>
        )}

        {/* ── ANIMATING ── */}
        {status === "animating" && (
          <View style={styles.animWrap}>
            <Text style={styles.animTitle}>뽑는 중...</Text>
            <Text style={styles.animSubtitle}>두근두근! 어떤 상품이 나올까요?</Text>
            <CyclingIcon />
            <View style={styles.animDots}>
              <View style={[styles.animDot, { opacity: 1 }]} />
              <View style={[styles.animDot, { opacity: 0.5 }]} />
              <View style={[styles.animDot, { opacity: 0.25 }]} />
            </View>
            <Text style={styles.animWait}>잠시만 기다려주세요</Text>
          </View>
        )}

        {/* ── RESULT ── */}
        {status === "result" && result && (
          <View style={styles.resultWrap}>
            <Text style={styles.resultTitle}>🎉 당첨!</Text>
            <Text style={styles.resultSubtitle}>오늘의 가챠 결과예요</Text>
            <ResultCard result={result} />
          </View>
        )}

        {/* ── ALREADY ROLLED ── */}
        {status === "already_rolled" && (
          <View style={styles.centerFlex}>
            <Text style={styles.stateEmoji}>⏰</Text>
            <Text style={styles.stateTitle}>오늘 이미 뽑았어요</Text>
            <Text style={styles.stateSubtitle}>가챠 뽑기는 하루에 한 번만 가능해요</Text>
            {nextAvailableAt && (
              <View style={styles.nextAtCard}>
                <Text style={styles.nextAtLabel}>다음 뽑기 가능 시간</Text>
                <Text style={styles.nextAtValue}>{formatNextAvailableAt(nextAvailableAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── NO VARIANTS ── */}
        {status === "no_variants" && (
          <View style={styles.centerFlex}>
            <Text style={styles.stateEmoji}>❓</Text>
            <Text style={styles.stateTitle}>아직 품목 정보가 없어요</Text>
            <Text style={styles.stateSubtitle}>품목 정보가 등록되면 뽑기를 이용할 수 있어요</Text>
          </View>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <View style={styles.centerFlex}>
            <Text style={styles.stateEmoji}>😵</Text>
            <Text style={styles.stateTitle}>오류가 발생했어요</Text>
            <Text style={styles.stateSubtitle}>{errorMessage}</Text>
          </View>
        )}

        {/* ── Bottom CTA ── */}
        {!isAnimating && (
          <View style={styles.bottomSection}>
            {status === "idle" && (
              <>
                <TouchableOpacity style={styles.ctaBtn} onPress={handleRollPress}>
                  <Text style={styles.ctaBtnText}>뽑기 시작</Text>
                </TouchableOpacity>
                <Text style={styles.bottomNote}>오늘 1회 남음 · 매일 자정 초기화</Text>
              </>
            )}
            {(status === "result" || status === "already_rolled" || status === "no_variants" || status === "error") && (
              <TouchableOpacity style={styles.closeOutlineBtn} onPress={onClose}>
                <Text style={styles.closeOutlineBtnText}>닫기</Text>
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

  // ─── Close button ───
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
  },
  closeBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 22,
    color: TEXT_GRAY,
    lineHeight: 26,
  },

  // ─── IDLE ───
  idleWrap: {
    flex: 1,
    paddingTop: 60,
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

  freeBadge: {
    backgroundColor: "rgba(233,75,140,0.12)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 12,
  },
  freeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },

  // ─── ANIMATING ───
  animWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 70,
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
    paddingTop: 60,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: PRIMARY_BG,
  },
  resultImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: PRIMARY_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 48 },
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
  resultDivider: { width: "100%", height: 1, backgroundColor: BORDER, marginVertical: 2 },
  resultNextAt: { fontSize: 12, color: TEXT_GRAY, textAlign: "center" },

  // ─── COMMON STATES ───
  centerFlex: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  stateEmoji: { fontSize: 64, marginBottom: 8 },
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
  nextAtValue: { fontSize: 18, fontWeight: "700", color: PRIMARY },

  // ─── BOTTOM ───
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 12,
    gap: 10,
  },
  ctaBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: { fontSize: 18, fontWeight: "700", color: WHITE },
  bottomNote: { fontSize: 12, color: TEXT_GRAY, textAlign: "center" },
  closeOutlineBtn: {
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  closeOutlineBtnText: { fontSize: 17, fontWeight: "700", color: TEXT_DARK },
});
