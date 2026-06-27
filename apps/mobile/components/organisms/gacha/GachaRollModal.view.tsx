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
  visible: boolean;
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

function FloatingBalls() {
  const anims = useRef(
    BALL_COLORS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(anim, {
            toValue: -8,
            duration: 900 + i * 60,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 900 + i * 60,
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <>
      {BALL_COLORS.map((c, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ball,
            { backgroundColor: c, ...BALL_POSITIONS[i] },
            { transform: [{ translateY: anims[i] }] },
          ]}
        />
      ))}
    </>
  );
}

const CYCLE_ICONS = ["🎲", "🎁", "⭐", "💎", "🎪", "🎠", "🎯", "🎊", "🎀", "🏆", "🎡", "🎨"];
const ANIMATION_TOTAL_MS = 2400;

function CyclingIcon() {
  const [iconIndex, setIconIndex] = useState(0);
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let elapsed = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const getDelay = (t: number): number => {
      if (t < 1200) return 110;
      if (t < 1800) return 220;
      return 480;
    };

    const tick = () => {
      if (elapsed >= ANIMATION_TOTAL_MS) return;
      const delay = getDelay(elapsed);
      elapsed += delay;

      setIconIndex((prev) => (prev + 1) % CYCLE_ICONS.length);

      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.25, duration: 55, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 75, useNativeDriver: true }),
      ]).start();

      timeout = setTimeout(tick, delay);
    };

    timeout = setTimeout(tick, 110);
    return () => clearTimeout(timeout);
  }, [iconScale]);

  return (
    <View style={styles.cyclingWrap}>
      <Text style={styles.animSparkle1}>✦</Text>
      <Text style={styles.animSparkle2}>✦</Text>
      <Text style={styles.animSparkle3}>✦</Text>
      <Animated.View style={[styles.cyclingCircle, { transform: [{ scale: iconScale }] }]}>
        <Text style={styles.cyclingEmoji}>{CYCLE_ICONS[iconIndex]}</Text>
      </Animated.View>
    </View>
  );
}

function ResultCard({ result }: { result: GachaRollResult }) {
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 6,
    }).start();
  }, []);

  const variant = result.variant;
  const displayName = variant.name_ko ?? variant.name;
  const nextAt = formatNextAvailableAt(result.permission.nextAvailableAt);

  return (
    <Animated.View style={[styles.resultCard, { transform: [{ scale }] }]}>
      {variant.image_url ? (
        <Image source={{ uri: variant.image_url }} style={styles.resultImage} />
      ) : (
        <View style={styles.resultImagePlaceholder}>
          <Text style={styles.resultPlaceholderEmoji}>🎲</Text>
        </View>
      )}
      <View style={styles.resultLabelWrap}>
        <Text style={styles.resultLabel}>가챠 결과</Text>
      </View>
      <Text style={styles.resultName} numberOfLines={2}>
        {displayName}
      </Text>
      {variant.name_ko && (
        <Text style={styles.resultSubName} numberOfLines={1}>
          {variant.name}
        </Text>
      )}
      <View style={styles.resultDivider} />
      <Text style={styles.resultNextAt}>다음 뽑기: {nextAt}</Text>
    </Animated.View>
  );
}

const GachaRollModalView = ({
  visible,
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
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    onRoll();
  };

  const isAnimating = status === "animating";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, isAnimating && styles.sheetAnimating]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close button */}
          {!isAnimating && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
          )}

          {/* ── LOADING VARIANTS ── */}
          {status === "loading_variants" && (
            <View style={styles.centerContent}>
              <ActivityIndicator color={PRIMARY} size="large" />
            </View>
          )}

          {/* ── IDLE ── */}
          {status === "idle" && (
            <View style={styles.idleContent}>
              <Text style={styles.title}>오늘의 가챠 뽑기</Text>
              <Text style={styles.subtitle}>
                이 가챠에서 어떤 상품이 뽑힐지 미리 확인해봐요!
              </Text>

              {/* Gacha machine illustration */}
              <View style={styles.machineWrap}>
                <View style={styles.dome}>
                  <FloatingBalls />
                </View>
                <View style={styles.machineConnector} />
                <View style={styles.machineBase}>
                  <View style={styles.machineKnob} />
                  <View style={styles.machineSlot} />
                </View>
              </View>

              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>🎲 하루 1회 무료 뽑기</Text>
              </View>
            </View>
          )}

          {/* ── ANIMATING ── */}
          {status === "animating" && (
            <View style={styles.animContent}>
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
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>🎉 당첨!</Text>
              <Text style={styles.resultSubtitle}>오늘의 가챠 결과예요</Text>
              <ResultCard result={result} />
            </View>
          )}

          {/* ── ALREADY ROLLED ── */}
          {status === "already_rolled" && (
            <View style={styles.centerContent}>
              <Text style={styles.stateEmoji}>⏰</Text>
              <Text style={styles.stateTitle}>오늘 이미 뽑았어요</Text>
              <Text style={styles.stateSubtitle}>
                가챠 뽑기는 하루에 한 번만 가능해요
              </Text>
              {nextAvailableAt && (
                <View style={styles.nextAtCard}>
                  <Text style={styles.nextAtLabel}>다음 뽑기 가능 시간</Text>
                  <Text style={styles.nextAtValue}>
                    {formatNextAvailableAt(nextAvailableAt)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── NO VARIANTS ── */}
          {status === "no_variants" && (
            <View style={styles.centerContent}>
              <Text style={styles.stateEmoji}>❓</Text>
              <Text style={styles.stateTitle}>아직 품목 정보가 없어요</Text>
              <Text style={styles.stateSubtitle}>
                품목 정보가 등록되면 뽑기를 이용할 수 있어요
              </Text>
            </View>
          )}

          {/* ── ERROR ── */}
          {status === "error" && (
            <View style={styles.centerContent}>
              <Text style={styles.stateEmoji}>😵</Text>
              <Text style={styles.stateTitle}>오류가 발생했어요</Text>
              <Text style={styles.stateSubtitle}>{errorMessage}</Text>
            </View>
          )}

          {/* Bottom CTA */}
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
              {(status === "result" ||
                status === "already_rolled" ||
                status === "no_variants" ||
                status === "error") && (
                <TouchableOpacity style={styles.closeOutlineBtn} onPress={onClose}>
                  <Text style={styles.closeOutlineBtnText}>닫기</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const BALL_COLORS = [PRIMARY, "#FF6B6B", "#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#FF6BCC"];
const BALL_POSITIONS: Array<{ top: number; left: number; width: number; height: number }> = [
  { top: 30, left: 60, width: 48, height: 48 },
  { top: 20, left: 106, width: 44, height: 44 },
  { top: 30, left: 148, width: 46, height: 46 },
  { top: 72, left: 38, width: 44, height: 44 },
  { top: 68, left: 88, width: 50, height: 50 },
  { top: 72, left: 140, width: 42, height: 42 },
  { top: 112, left: 65, width: 46, height: 46 },
];

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: PRIMARY_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    minHeight: 520,
  },
  sheetAnimating: {
    backgroundColor: PRIMARY,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: GRAY_300,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  closeBtn: {
    position: "absolute",
    top: 22,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GRAY_100,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 20,
    color: TEXT_GRAY,
    lineHeight: 24,
  },

  // ─── IDLE ───
  idleContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
    marginTop: 8,
  },
  machineWrap: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  dome: {
    width: 200,
    height: 170,
    borderRadius: 100,
    backgroundColor: "#EEF0FF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: GRAY_300,
    position: "relative",
  },
  ball: {
    position: "absolute",
    borderRadius: 99,
  },
  machineConnector: {
    width: 70,
    height: 16,
    backgroundColor: "#3A3A45",
    borderRadius: 4,
  },
  machineBase: {
    width: 140,
    height: 100,
    backgroundColor: "#2D2D38",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  machineKnob: {
    width: 54,
    height: 40,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  machineSlot: {
    width: 70,
    height: 14,
    borderRadius: 3,
    backgroundColor: "#111119",
  },
  freeBadge: {
    backgroundColor: "rgba(233,75,140,0.12)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 8,
  },
  freeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
  },

  // ─── ANIMATING ───
  animContent: {
    paddingTop: 24,
    alignItems: "center",
  },
  animTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: WHITE,
    textAlign: "center",
  },
  animSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    marginBottom: 24,
  },
  cyclingWrap: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cyclingCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cyclingEmoji: {
    fontSize: 72,
  },
  animSparkle1: {
    position: "absolute",
    top: 16,
    left: -8,
    fontSize: 22,
    color: WHITE,
  },
  animSparkle2: {
    position: "absolute",
    top: 24,
    right: -8,
    fontSize: 18,
    color: WHITE,
  },
  animSparkle3: {
    position: "absolute",
    bottom: 20,
    right: 0,
    fontSize: 14,
    color: WHITE,
  },
  animDots: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
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
  resultContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  resultSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginTop: 4,
    marginBottom: 16,
  },
  resultCard: {
    width: SCREEN_WIDTH - 64,
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  resultImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: PRIMARY_BG,
  },
  resultImagePlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: PRIMARY_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  resultPlaceholderEmoji: {
    fontSize: 44,
  },
  resultLabelWrap: {
    backgroundColor: PRIMARY_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
  },
  resultName: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  resultSubName: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  resultDivider: {
    width: "100%",
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
  },
  resultNextAt: {
    fontSize: 12,
    color: TEXT_GRAY,
    textAlign: "center",
  },

  // ─── COMMON STATE ───
  centerContent: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 32,
    gap: 8,
  },
  stateEmoji: {
    fontSize: 60,
    marginBottom: 8,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  stateSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  nextAtCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginTop: 12,
    gap: 4,
    alignItems: "center",
  },
  nextAtLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  nextAtValue: {
    fontSize: 17,
    fontWeight: "700",
    color: PRIMARY,
  },

  // ─── BOTTOM ───
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  ctaBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
  },
  bottomNote: {
    fontSize: 12,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  closeOutlineBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  closeOutlineBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
});

export default GachaRollModalView;
