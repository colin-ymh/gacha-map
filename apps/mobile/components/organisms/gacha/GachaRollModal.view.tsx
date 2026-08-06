import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Alert,
  Share,
  Platform,
  Linking,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import RNShare, { Social } from "react-native-share";
import { useTranslation } from "react-i18next";
import type { GachaDailyQuota, GachaRollResult } from "@gacha-map/shared";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";

import type { GachaRollStatus } from "@/hooks/useGachaRoll";
import {
  PRIMARY,
  PRIMARY_BG,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_200,
  DIVIDER_SUBTLE,
  GLASS_WHITE,
  primaryAlpha,
} from "@/constants/colors";
import {
  SHARE_WEB_ORIGIN,
  SHARE_LOCALES,
  INSTAGRAM_APP_ID,
  INSTAGRAM_ANDROID_PACKAGE,
  INSTAGRAM_STORIES_SCHEME,
} from "@/constants/share";
import { objectParticle } from "@/lib/koreanParticle";
import GachaShareCard from "./GachaShareCard";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  status: GachaRollStatus;
  result: GachaRollResult | null;
  nextAvailableAt: string | null;
  errorMessage: string | null;
  isLoggedIn: boolean;
  /** 내 초대 코드. 공유 링크에 붙으면 친구가 열었을 때 뽑기 기회가 하나 늘어난다. */
  referralCode: string | null;
  /** 소진 화면에 보여줄 그날 총 횟수(기본 + 초대 보너스). 서버 계산값이다. */
  dailyLimitTotal: number | null;
  /** 오늘의 뽑기 쿼터. 서버 계산값이며 null이면 아직 모르거나 비로그인이다. */
  quota: GachaDailyQuota | null;
  nickname?: string | null;
  productName?: string;
  productImageUrl?: string | null;
  onRoll: () => void;
  onClose: () => void;
  onLoginRequired: () => void;
  onChangeGacha?: () => void;
  onRecordsPress?: () => void;
  asScreen?: boolean;
  overlay?: React.ReactNode;
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
  if (locale.startsWith("ja") || locale.startsWith("zh"))
    return `${mo}月${day}日 ${time}`;
  return `${mo}/${day} ${time}`;
}

// ─── Capsule specs — pastel palette, clear dome top + solid bottom ───
const CAPSULE_SPECS = [
  { base: "#F9AABF" }, // soft pink
  { base: "#C5A3E0" }, // soft purple
  { base: "#F9E4A0" }, // soft yellow
  { base: "#A8DCCA" }, // mint
  { base: "#A3CFF0" }, // sky blue
  { base: "#F9BF9E" }, // peach
  { base: "#C8BAF5" }, // lavender
  { base: "#B5E0A8" }, // soft green
  { base: "#F5A0C5" }, // hot pink pastel
  { base: "#AFC5F5" }, // periwinkle
  { base: "#FAD4A0" }, // soft orange
  { base: "#A0D8EF" }, // baby blue
  { base: "#D4A8DC" }, // orchid
  { base: "#A8E6CF" }, // seafoam
];

const CAPSULE_POSITIONS: Array<{ top: number; left: number; size: number }> = [
  // Row 1
  { top: 8, left: 30, size: 48 },
  { top: 4, left: 90, size: 44 },
  { top: 10, left: 148, size: 46 },
  // Row 2
  { top: 52, left: 10, size: 46 },
  { top: 48, left: 68, size: 52 },
  { top: 50, left: 132, size: 46 },
  { top: 46, left: 184, size: 38 },
  // Row 3
  { top: 100, left: 24, size: 48 },
  { top: 96, left: 86, size: 50 },
  { top: 98, left: 150, size: 46 },
  // Row 4
  { top: 148, left: 42, size: 44 },
  { top: 144, left: 104, size: 48 },
  { top: 150, left: 164, size: 40 },
  // Row 5
  { top: 190, left: 80, size: 40 },
];

const CAPSULE_ROTATIONS = [
  12, -25, 8, -38, 20, -15, 45, -30, 5, 35, -20, 10, -42, 28,
];

function GachaCapsule({
  spec,
  size,
  style,
}: {
  spec: (typeof CAPSULE_SPECS)[0];
  size: number;
  style?: object;
}) {
  const w = size;
  const h = Math.round(size * 1.05);
  const r = w / 2;
  const halfH = h / 2;

  return (
    <View
      style={[
        { width: w, height: h, borderRadius: r, overflow: "hidden" },
        style,
      ]}
    >
      {/* Solid pastel body */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.base }]} />
      {/* Clear plastic dome simulation (top half) */}
      <View
        style={{ height: halfH, backgroundColor: "rgba(255,255,255,0.38)" }}
      />
      {/* Seam line */}
      <View
        style={{
          position: "absolute",
          top: halfH - 1,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: "rgba(0,0,0,0.12)",
        }}
      />
      {/* Shine highlight */}
      <View
        style={{
          position: "absolute",
          top: "10%",
          left: "16%",
          width: "28%",
          height: "18%",
          borderRadius: 99,
          backgroundColor: "rgba(255,255,255,0.70)",
        }}
      />
    </View>
  );
}

function FloatingCapsules() {
  const anims = useRef(CAPSULE_SPECS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(anim, {
            toValue: -7,
            duration: 860 + i * 45,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 860 + i * 45,
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
      {CAPSULE_SPECS.map((spec, i) => {
        const pos = CAPSULE_POSITIONS[i];
        const deg = CAPSULE_ROTATIONS[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              transform: [{ translateY: anims[i] }, { rotate: `${deg}deg` }],
            }}
          >
            <GachaCapsule spec={spec} size={pos.size} />
          </Animated.View>
        );
      })}
    </>
  );
}

// ─── Box-style Gacha Machine ───
const BOX_W = SCREEN_WIDTH - 100;
const BOX_WINDOW_H = Math.round(BOX_W * 0.85);
const BOX_BOTTOM_H = 96;

// 다이얼 노브
const DIAL_SIZE = 72;
const DIAL_INNER = 56;

function DialKnob({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const idleRef = useRef<Animated.CompositeAnimation | null>(null);

  const startIdle = useCallback(() => {
    rotateAnim.setValue(0);
    idleRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 360,
        duration: 2200,
        useNativeDriver: true,
      }),
    );
    idleRef.current.start();
  }, [rotateAnim]);

  useEffect(() => {
    if (!disabled) startIdle();
    else {
      idleRef.current?.stop();
      rotateAnim.setValue(0);
    }
    return () => idleRef.current?.stop();
  }, [disabled, startIdle]);

  const handlePress = () => {
    idleRef.current?.stop();
    rotateAnim.setValue(0);
    // 빠르게 360도 × 2 → 아이들 복귀
    Animated.timing(rotateAnim, {
      toValue: 720,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      if (!disabled) startIdle();
    });
    onPress();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {/* 외부 링 */}
      <View style={knobStyles.ring}>
        {/* 회전하는 다이얼 */}
        <Animated.View style={[knobStyles.dial, { transform: [{ rotate }] }]}>
          {/* 그립 라인 */}
          <View style={knobStyles.gripLine} />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const knobStyles = StyleSheet.create({
  ring: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: "#2A2A3E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: PRIMARY,
  },
  dial: {
    width: DIAL_INNER,
    height: DIAL_INNER,
    borderRadius: DIAL_INNER / 2,
    backgroundColor: "#E8E8F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gripLine: {
    width: "68%",
    height: 10,
    borderRadius: 2,
    backgroundColor: "#AAAABE",
  },
});

function GachaMachine({
  onRoll,
  disabled,
  productImageUrl,
}: {
  onRoll: () => void;
  disabled: boolean;
  productImageUrl?: string | null;
}) {
  return (
    <View style={machineStyles.body}>
      {/* Top bar — 로고 텍스트 */}
      <View style={machineStyles.topBar}>
        <Text style={machineStyles.topLogo}>GACHA MAP</Text>
      </View>

      {/* Display window */}
      <View style={machineStyles.windowFrame}>
        <View style={machineStyles.window}>
          {productImageUrl ? (
            <Image
              source={{ uri: productImageUrl }}
              style={machineStyles.windowProductImage}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#E8E8F0" }]}
            />
          )}
        </View>
      </View>

      {/* Panel divider */}
      <View style={machineStyles.divider} />

      {/* Control panel */}
      <View style={machineStyles.controlPanel}>
        {/* LEFT: Dispensing slot */}
        <View style={machineStyles.slotOuter}>
          <View style={machineStyles.slotInner} />
        </View>

        {/* CENTER: LCD display */}
        <View style={machineStyles.lcd}>
          <Text style={machineStyles.lcdLine1}>{"↻  TURN"}</Text>
          <Text style={machineStyles.lcdLine2}>{"돌려서 뽑기"}</Text>
        </View>

        {/* RIGHT: 다이얼 노브 */}
        <DialKnob onPress={onRoll} disabled={disabled} />
      </View>
    </View>
  );
}

const machineStyles = StyleSheet.create({
  body: {
    width: BOX_W,
    backgroundColor: "#F2F2F5",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: GRAY_200,
  },
  topBar: {
    height: 40,
    backgroundColor: "#EAEAEF",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_200,
  },
  topLogo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9090A8",
    letterSpacing: 2,
  },
  windowFrame: {
    margin: 12,
    borderRadius: 10,
    backgroundColor: GRAY_200,
    padding: 3,
  },
  window: {
    height: BOX_WINDOW_H,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E8E8F0",
  },
  windowProductImage: {
    ...StyleSheet.absoluteFillObject,
  },
  divider: {
    height: 1,
    backgroundColor: GRAY_200,
  },
  controlPanel: {
    height: BOX_BOTTOM_H,
    backgroundColor: "#EAEAEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  slotOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#3C3C4E",
    alignItems: "center",
    justifyContent: "center",
  },
  slotInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A28",
  },
  lcd: {
    width: 86,
    height: 54,
    backgroundColor: "#0A180A",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  lcdLine1: {
    fontSize: 12,
    fontWeight: "700",
    color: "#33FF66",
    letterSpacing: 1,
  },
  lcdLine2: {
    fontSize: 10,
    color: "#22CC44",
  },
});

// ─── Cycling icon (animating state) ───
const CYCLE_ICONS = [
  "🎲",
  "🎁",
  "⭐",
  "💎",
  "🎪",
  "🎠",
  "🎯",
  "🎊",
  "🎀",
  "🏆",
  "🎡",
  "🎨",
];
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
      setIconIndex((p) => {
        let next: number;
        do {
          next = Math.floor(Math.random() * CYCLE_ICONS.length);
        } while (next === p);
        return next;
      });
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.3,
          duration: 55,
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
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
      <Animated.View
        style={[styles.cyclingCircle, { transform: [{ scale: iconScale }] }]}
      >
        <Text style={styles.cyclingEmoji}>{CYCLE_ICONS[iconIndex]}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Main view ───
const GachaRollModalView = ({
  status,
  result,
  nextAvailableAt,
  errorMessage,
  isLoggedIn,
  referralCode,
  dailyLimitTotal,
  quota,
  nickname,
  productImageUrl,
  onRoll,
  onClose,
  onLoginRequired,
  onChangeGacha,
  onRecordsPress,
  asScreen = false,
  overlay,
}: Props) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    onPressIn: closePressIn,
    animatedStyle: closeAnimStyle,
    brightnessValue: closeBrightness,
  } = useLiquidGlassPress();
  const {
    onPressIn: changePressIn,
    animatedStyle: changeAnimStyle,
    brightnessValue: changeBrightness,
  } = useLiquidGlassPress();
  const {
    onPressIn: recordsPressIn,
    animatedStyle: recordsAnimStyle,
    brightnessValue: recordsBrightness,
  } = useLiquidGlassPress();
  const {
    onPressIn: rerollPressIn,
    animatedStyle: rerollAnimStyle,
    brightnessValue: rerollBrightness,
  } = useLiquidGlassPress();
  const {
    onPressIn: idleCtaPressIn,
    animatedStyle: idleCtaAnimStyle,
    brightnessValue: idleCtaBrightness,
  } = useLiquidGlassPress();
  const {
    onPressIn: sharePressIn,
    animatedStyle: shareAnimStyle,
    brightnessValue: shareBrightness,
  } = useLiquidGlassPress();
  const [resultDismissed, setResultDismissed] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    if (status === "result") setResultDismissed(false);
  }, [status, result]);

  const shareLink = async () => {
    if (isSharing || !result) return;
    setIsSharing(true);
    try {
      const displayName = result.variant.name_ko ?? result.variant.name;
      const tries = result.stats.totalCount;
      const owned =
        result.stats.variantStats.find((v) => v.variantId === result.variant.id)
          ?.count ?? 1;
      // 통계는 링크에 실어 보낸다 — 웹은 로그인하지 않은 방문자를 상대하므로
      // RLS에 막힌 뽑기 기록을 조회할 수 없다. `{uuid}-{시도}-{보유}` 형식이며,
      // 통계가 없는 `/r/{uuid}` 형태도 웹이 계속 지원한다.
      const slug = `${result.variant.id}-${tries}-${owned}`;
      // locale을 직접 붙여 완성된 URL을 공유한다. prefix 없이 보내면 next-intl의
      // localeDetection이 봇의 Accept-Language로 locale을 정해 프리뷰가 흔들린다.
      const lang = SHARE_LOCALES.includes(i18n.language) ? i18n.language : "ko";
      // ref는 초대 보상용이라 없으면 그냥 붙이지 않는다 — 링크 자체는 그대로 동작한다.
      const query = referralCode ? `?ref=${referralCode}` : "";
      const url = `${SHARE_WEB_ORIGIN}/${lang}/r/${slug}${query}`;
      // url 필드는 쓰지 않는다. iOS는 message와 url을 각각 별도 항목으로 넘겨
      // 수신 앱에서 둘로 나뉘어 보이고, Android는 아예 url을 버린다.
      // 텍스트 하나로 합쳐 보내면 양쪽 동일하게 한 덩어리로 가고,
      // 메신저는 본문 안의 URL을 그대로 unfurl 한다.
      // i18next는 `count` 키를 복수형 규칙에 쓰므로, 로케일별 _one/_other 변형을
      // 만들지 않도록 `tries`라는 일반 변수명을 쓴다.
      // particle은 한국어 문구에서만 쓰인다 — i18next는 나머지 로케일에서
      // 사용되지 않는 보간 변수를 그냥 무시한다.
      const text = t("gacha.roll.shareMessage", {
        tries,
        name: displayName,
        particle: objectParticle(displayName),
      });
      await Share.share({ message: `${text}\n\n${url}` });
    } catch {
      Alert.alert(t("gacha.roll.shareFailed"));
    } finally {
      setIsSharing(false);
    }
  };

  const shareToInstagramStory = async () => {
    if (isSharing || !shareCardRef.current) return;
    setIsSharing(true);
    try {
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
      });
      await RNShare.shareSingle({
        social: Social.InstagramStories,
        appId: INSTAGRAM_APP_ID,
        backgroundImage: uri,
        backgroundTopColor: WHITE,
        backgroundBottomColor: PRIMARY_BG,
      });
    } catch {
      // 링크 공유로 자동 폴백하지 않는다 — 인스타를 고른 사용자에게
      // 말없이 다른 앱이 뜨면 더 혼란스럽다.
      Alert.alert(t("gacha.roll.shareFailed"));
    } finally {
      setIsSharing(false);
    }
  };

  const handleShare = async () => {
    if (isSharing || !result) return;

    // 인스타 경로가 불가능하면 선택지를 띄우지 않고 곧장 링크 공유한다 —
    // 고를 게 하나뿐인 시트는 불필요한 단계다.
    if (!INSTAGRAM_APP_ID) {
      await shareLink();
      return;
    }

    // 설치 확인은 Info.plist(LSApplicationQueriesSchemes)와 Android <queries>
    // 선언이 있어야 동작한다. 없으면 설치돼 있어도 false가 돌아온다.
    let instagramAvailable = false;
    try {
      instagramAvailable =
        Platform.OS === "ios"
          ? await Linking.canOpenURL(INSTAGRAM_STORIES_SCHEME)
          : (await RNShare.isPackageInstalled(INSTAGRAM_ANDROID_PACKAGE))
              .isInstalled;
    } catch {
      instagramAvailable = false;
    }

    if (!instagramAvailable) {
      await shareLink();
      return;
    }

    Alert.alert(t("gacha.roll.shareTitle"), undefined, [
      { text: t("gacha.roll.shareToStory"), onPress: shareToInstagramStory },
      { text: t("gacha.roll.shareLink"), onPress: shareLink },
      { text: t("gacha.roll.shareCancel"), style: "cancel" },
    ]);
  };

  const handleRollPress = () => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    setResultDismissed(false);
    onRoll();
  };

  const isAnimating = status === "animating";
  const isLoading = status === "loading_variants";
  const isRollableState =
    status === "idle" ||
    status === "animating" ||
    status === "loading_variants";

  const inner = (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <LinearGradient
        colors={[WHITE, PRIMARY_BG]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* 헤더 — 항상 렌더해서 높이 고정 */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* 좌측: 돌아가기 */}
        <LiquidGlass
          borderRadius={20}
          style={[
            closeAnimStyle,
            (isAnimating || (status === "result" && !resultDismissed)) &&
              styles.hidden,
          ]}
          brightnessOpacity={isAnimating ? 0 : closeBrightness}
        >
          <TouchableOpacity
            onPress={isAnimating ? undefined : onClose}
            onPressIn={isAnimating ? undefined : closePressIn}
            activeOpacity={1}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeBtn}
          >
            <Ionicons name="chevron-back" size={20} color={TEXT_DARK} />
          </TouchableOpacity>
        </LiquidGlass>

        <View style={{ flex: 1 }} />

        {/* 우측: 기록 / 가챠 변경 */}
        <View style={styles.headerRightRow}>
          {onRecordsPress && (
            <LiquidGlass
              borderRadius={20}
              style={[
                recordsAnimStyle,
                (isAnimating || (status === "result" && !resultDismissed)) &&
                  styles.hidden,
              ]}
              brightnessOpacity={isAnimating ? undefined : recordsBrightness}
            >
              <TouchableOpacity
                onPress={isAnimating ? undefined : onRecordsPress}
                onPressIn={isAnimating ? undefined : recordsPressIn}
                activeOpacity={1}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.changeBtnInner}
              >
                <Ionicons name="list-outline" size={16} color={TEXT_DARK} />
                <Text style={styles.recordsBtnText}>
                  {t("gacha.roll.recordsBtn", { defaultValue: "기록" })}
                </Text>
              </TouchableOpacity>
            </LiquidGlass>
          )}

          {onChangeGacha ? (
            <LiquidGlass
              borderRadius={20}
              overlayColor={primaryAlpha(0.12)}
              style={[
                changeAnimStyle,
                (isAnimating || (status === "result" && !resultDismissed)) &&
                  styles.hidden,
              ]}
              brightnessOpacity={isAnimating ? undefined : changeBrightness}
            >
              <TouchableOpacity
                onPress={isAnimating ? undefined : onChangeGacha}
                onPressIn={isAnimating ? undefined : changePressIn}
                activeOpacity={1}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.changeBtnInner}
              >
                <Ionicons name="swap-horizontal" size={16} color={PRIMARY} />
                <Text style={styles.changeBtnText}>
                  {t("roll.change", { defaultValue: "변경" })}
                </Text>
              </TouchableOpacity>
            </LiquidGlass>
          ) : (
            <View style={styles.changeBtnInner} pointerEvents="none" />
          )}
        </View>
      </View>

      {/* ── 머신 (loading / idle / animating / result-closed 공통) ── */}
      {(isRollableState || (status === "result" && resultDismissed)) && (
        <View style={styles.idleWrap}>
          {/* 타이틀 — 상단 고정 */}
          <View style={styles.idleTitleBlock}>
            <Text style={styles.idleTitle}>{t("gacha.roll.title")}</Text>
            <Text style={styles.idleSubtitle}>{t("gacha.roll.subtitle")}</Text>
          </View>
          {/* 머신 — 남은 공간 중앙 */}
          <View style={styles.machineArea}>
            <View style={styles.machineContainer}>
              <GachaMachine
                onRoll={handleRollPress}
                disabled={isAnimating || isLoading}
                productImageUrl={productImageUrl}
              />
              {isLoading && (
                <View style={styles.machineLoadingOverlay}>
                  <ActivityIndicator color={PRIMARY} size="large" />
                </View>
              )}
            </View>
          </View>

          {/* 하단 CTA — 레버와 동일 동작 */}
          <LiquidGlass
            borderRadius={16}
            overlayColor={primaryAlpha(0.15)}
            style={[idleCtaAnimStyle, styles.idleCtaBtn]}
            brightnessOpacity={idleCtaBrightness}
          >
            <TouchableOpacity
              style={styles.ctaBtnInner}
              onPress={handleRollPress}
              onPressIn={idleCtaPressIn}
              activeOpacity={1}
              disabled={isAnimating || isLoading}
            >
              <Text style={styles.ctaBtnText}>{t("gacha.roll.rollCta")}</Text>
            </TouchableOpacity>
          </LiquidGlass>

          {quota && (
            <Text style={styles.remainingText}>
              {t("gacha.roll.remainingCount", {
                remaining: quota.remaining,
                total: quota.base + quota.bonus,
              })}
            </Text>
          )}
        </View>
      )}

      {/* ── 뽑는 중 오버레이 ── */}
      {status === "animating" && (
        <View style={[StyleSheet.absoluteFill, styles.animOverlay]}>
          <CyclingIcon />
        </View>
      )}

      {/* ── ALREADY ROLLED ── */}
      {status === "already_rolled" && (
        <View style={styles.stateWrap}>
          <Ionicons name="time-outline" size={32} color={TEXT_GRAY} />
          <Text style={styles.stateTitle}>
            {t("gacha.roll.alreadyRolledTitle")}
          </Text>
          <Text style={styles.stateSubtitle}>
            {t("gacha.roll.alreadyRolledSubtitle")}
          </Text>
          {nextAvailableAt && (
            <View style={styles.nextAtCard}>
              <Text style={styles.nextAtLabel}>
                {t("gacha.roll.nextRollLabel")}
              </Text>
              <Text style={styles.nextAtValue}>
                {formatNextAvailableAt(nextAvailableAt, i18n.language)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── DAILY LIMIT ── */}
      {status === "daily_limit" && (
        <View style={styles.stateWrap}>
          <Ionicons
            name="checkmark-circle-outline"
            size={32}
            color={TEXT_GRAY}
          />
          <Text style={styles.stateTitle}>
            {t("gacha.roll.dailyLimitTitle")}
          </Text>
          {dailyLimitTotal !== null && (
            <Text style={styles.stateSubtitle}>
              {t("gacha.roll.dailyLimitSubtitle", { limit: dailyLimitTotal })}
            </Text>
          )}
          <Text style={styles.stateSubtitle}>
            {t("gacha.roll.dailyLimitShareHint")}
          </Text>
          {nextAvailableAt && (
            <View style={styles.nextAtCard}>
              <Text style={styles.nextAtLabel}>
                {t("gacha.roll.nextRollTomorrowLabel")}
              </Text>
              <Text style={styles.nextAtValue}>
                {formatNextAvailableAt(nextAvailableAt, i18n.language)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── NO VARIANTS ── */}
      {status === "no_variants" && (
        <View style={styles.stateWrap}>
          <Ionicons name="help-circle-outline" size={32} color={TEXT_GRAY} />
          <Text style={styles.stateTitle}>
            {t("gacha.roll.noVariantsTitle")}
          </Text>
          <Text style={styles.stateSubtitle}>
            {t("gacha.roll.noVariantsSubtitle")}
          </Text>
        </View>
      )}

      {/* ── ERROR ── */}
      {status === "error" && (
        <View style={styles.stateWrap}>
          <Ionicons name="alert-circle-outline" size={32} color={TEXT_GRAY} />
          <Text style={styles.stateTitle}>{t("gacha.roll.errorTitle")}</Text>
          <Text style={styles.stateSubtitle}>
            {errorMessage ?? t("gacha.roll.errorSubtitle")}
          </Text>
        </View>
      )}

      {/* ── RESULT (전체화면) ── */}
      {status === "result" && result && !resultDismissed && (
        <View style={styles.resultFullscreen}>
          <LinearGradient
            colors={[WHITE, PRIMARY_BG]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* 자체 상단바: 뒤로가기 */}
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <LiquidGlass borderRadius={20} style={closeAnimStyle}>
              <TouchableOpacity
                onPress={() => setResultDismissed(true)}
                onPressIn={closePressIn}
                activeOpacity={1}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeBtn}
              >
                <Ionicons name="chevron-back" size={20} color={TEXT_DARK} />
              </TouchableOpacity>
            </LiquidGlass>
          </View>

          {/* 카드 위 타이틀 — 닉네임만 핑크 강조.
              suffix 방식이라 지원 로케일(ko/en/ja/zh) 모두 닉네임이 문두여야 한다. */}
          <Text style={styles.resultLead}>
            {nickname ? (
              <>
                <Text style={styles.resultLeadName}>{nickname}</Text>
                {t("gacha.roll.resultLeadTitleSuffix")}
              </>
            ) : (
              t("gacha.roll.resultLeadTitleAnon")
            )}
          </Text>

          {/* 결과 카드 */}
          <View style={styles.resultFullBody}>
            <LiquidGlass
              borderRadius={24}
              style={styles.resultCardGlass}
              overlayColor={GLASS_WHITE}
              intensity={65}
              androidElevation={3}
            >
              <View style={styles.resultCardInner}>
                <Text style={styles.resultCardName} numberOfLines={2}>
                  {result.variant.name_ko ?? result.variant.name}
                </Text>
                {result.variant.name_ko && (
                  <Text style={styles.resultCardSubName} numberOfLines={1}>
                    {result.variant.name}
                  </Text>
                )}

                {result.variant.image_url ? (
                  <Image
                    source={{ uri: result.variant.image_url }}
                    style={styles.resultCardImage}
                    resizeMode="contain"
                  />
                ) : (
                  <GachaPlaceholder size={240} borderRadius={16} />
                )}

                <View style={styles.resultCardDivider} />

                <View style={styles.resultStatRow}>
                  <Text style={styles.resultStatLabel}>
                    {t("gacha.roll.statGachaTriesLabel")}
                  </Text>
                  <Text style={styles.resultStatValue}>
                    {t("gacha.roll.statCountUnit", {
                      count: result.stats.totalCount,
                    })}
                  </Text>
                </View>

                <View style={styles.resultStatRow}>
                  <Text style={styles.resultStatLabel}>
                    {t("gacha.roll.statVariantTriesLabel")}
                  </Text>
                  <Text style={styles.resultStatValue}>
                    {t("gacha.roll.statCountUnit", {
                      count:
                        result.stats.variantStats.find(
                          (v) => v.variantId === result.variant.id,
                        )?.count ?? 1,
                    })}
                  </Text>
                </View>
              </View>
            </LiquidGlass>

            {/* 남은 횟수 — 카드 밖, 보조 정보라 회색으로 둔다 */}
            <Text style={styles.resultRemainingText}>
              {t("gacha.roll.remainingCount", {
                remaining: result.permission.remainingToday,
                total: result.permission.base + result.permission.bonus,
              })}
            </Text>
          </View>

          {/* 하단 버튼 행 */}
          <View style={styles.resultFullBtnRow}>
            <LiquidGlass
              borderRadius={16}
              overlayColor={primaryAlpha(0.15)}
              style={[shareAnimStyle, styles.resultFullBtn]}
              brightnessOpacity={shareBrightness}
            >
              <TouchableOpacity
                style={styles.ctaBtnInner}
                onPress={handleShare}
                onPressIn={sharePressIn}
                activeOpacity={1}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text style={styles.ctaBtnText}>{t("gacha.roll.share")}</Text>
                )}
              </TouchableOpacity>
            </LiquidGlass>
            <LiquidGlass
              borderRadius={16}
              style={[rerollAnimStyle, styles.resultFullBtn]}
              brightnessOpacity={rerollBrightness}
            >
              <TouchableOpacity
                style={styles.completeBtnInner}
                onPress={handleRollPress}
                onPressIn={rerollPressIn}
                activeOpacity={1}
              >
                <Text style={styles.completeBtnText}>
                  {t("gacha.roll.reroll")}
                </Text>
              </TouchableOpacity>
            </LiquidGlass>
          </View>
        </View>
      )}

      {INSTAGRAM_APP_ID && result && (
        <View style={styles.shareCardOffscreen} pointerEvents="none">
          <GachaShareCard ref={shareCardRef} result={result} />
        </View>
      )}

      {overlay}
    </SafeAreaView>
  );

  if (asScreen) return inner;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={isAnimating ? undefined : onClose}
    >
      {inner}
    </Modal>
  );
};

export default GachaRollModalView;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // ─── Header ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 4,
    minHeight: 52,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  changeBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 36,
    minHeight: 36,
    justifyContent: "center",
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  recordsBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  hidden: {
    opacity: 0,
    pointerEvents: "none" as const,
  },

  // ─── IDLE ───
  idleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  idleTitleBlock: {
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  idleTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
  },
  idleSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  remainingText: {
    marginTop: 10,
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  machineArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    marginTop: 16,
  },
  idleCtaBtn: {
    width: "100%",
    marginTop: 16,
    marginBottom: 32,
  },
  machineContainer: {
    alignItems: "center",
  },
  machineLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── STATE (already_rolled / daily_limit / error / no_variants) ───
  stateWrap: {
    flex: 1,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  // ─── ANIMATING POPUP ───
  animOverlay: {
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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
  sparkle1: {
    position: "absolute",
    top: 18,
    left: 8,
    fontSize: 24,
    color: WHITE,
  },
  sparkle2: {
    position: "absolute",
    top: 28,
    right: 4,
    fontSize: 18,
    color: WHITE,
  },
  sparkle3: {
    position: "absolute",
    bottom: 24,
    right: 12,
    fontSize: 14,
    color: WHITE,
  },
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
  resultImagePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: PRIMARY_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 60 },
  resultNextAtOutside: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
    marginTop: 16,
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

  // ─── RESULT (전체화면) ───
  resultFullscreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  resultLead: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resultLeadName: {
    color: PRIMARY,
  },
  resultFullBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  resultCardGlass: {
    width: "100%",
    maxWidth: 320,
    alignSelf: "center",
    // 공유 LiquidGlass 기본 그림자(0.14/16/8)보다 옅게 — 카드에만 적용
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resultCardInner: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  resultCardName: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
  },
  resultCardSubName: {
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  resultCardImage: {
    width: 240,
    height: 240,
    marginVertical: 8,
  },
  resultCardDivider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER_SUBTLE,
    marginVertical: 4,
  },
  resultStatRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  resultStatLabel: {
    fontSize: 15,
    color: TEXT_GRAY,
  },
  resultStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  resultRemainingText: {
    marginTop: 12,
    fontSize: 13,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  resultFullBtnRow: {
    width: "100%",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
  },
  resultFullBtn: {
    width: "100%",
  },
  ctaBtnInner: {
    width: "100%",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: { fontSize: 17, fontWeight: "700", color: PRIMARY },
  completeBtnInner: {
    width: "100%",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  completeBtnText: { fontSize: 17, color: TEXT_GRAY },
  // 화면 밖에 두되 레이아웃은 살아 있어야 captureRef가 찍을 수 있다.
  shareCardOffscreen: {
    position: "absolute",
    top: -9999,
    left: 0,
  },
});
