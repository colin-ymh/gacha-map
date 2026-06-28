import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Image,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { BLACK, WHITE } from "@/constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

interface Props {
  images: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

interface ImgSize {
  baseW: number;
  baseH: number;
}

function computeBase(imgW: number, imgH: number): ImgSize {
  const ratio = imgW / imgH;
  let baseW = SCREEN_W;
  let baseH = SCREEN_W / ratio;
  if (baseH > SCREEN_H) {
    baseH = SCREEN_H;
    baseW = SCREEN_H * ratio;
  }
  return { baseW, baseH };
}

export default function ImageViewerModal({
  images,
  initialIndex,
  visible,
  onClose,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imgSize, setImgSize] = useState<ImgSize>({
    baseW: SCREEN_W,
    baseH: SCREEN_H,
  });

  const scale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const panStartTx = useSharedValue(0);
  const panStartTy = useSharedValue(0);

  function resetTransform() {
    "worklet";
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    tx.value = withSpring(0, { damping: 20, stiffness: 200 });
    ty.value = withSpring(0, { damping: 20, stiffness: 200 });
  }

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  useEffect(() => {
    const url = images[currentIndex];
    if (!url) return;
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    Image.getSize(
      url,
      (w, h) => setImgSize(computeBase(w, h)),
      () => setImgSize({ baseW: SCREEN_W, baseH: SCREEN_H }),
    );
  }, [currentIndex, images, scale, tx, ty]);

  const { baseW, baseH } = imgSize;

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      pinchStartScale.value = scale.value;
    })
    .onUpdate((e) => {
      "worklet";
      const s = Math.min(MAX_SCALE, Math.max(1, pinchStartScale.value * e.scale));
      scale.value = s;
      const maxX = Math.max(0, (baseW * s - SCREEN_W) / 2);
      const maxY = Math.max(0, (baseH * s - SCREEN_H) / 2);
      tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
      ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
    })
    .onEnd(() => {
      "worklet";
      if (scale.value < 1) {
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        tx.value = withSpring(0, { damping: 20, stiffness: 200 });
        ty.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      "worklet";
      panStartTx.value = tx.value;
      panStartTy.value = ty.value;
    })
    .onUpdate((e) => {
      "worklet";
      const s = scale.value;
      const maxX = Math.max(0, (baseW * s - SCREEN_W) / 2);
      const maxY = Math.max(0, (baseH * s - SCREEN_H) / 2);
      tx.value = Math.min(maxX, Math.max(-maxX, panStartTx.value + e.translationX));
      ty.value = Math.min(maxY, Math.max(-maxY, panStartTy.value + e.translationY));
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      "worklet";
      if (scale.value > 1) {
        resetTransform();
      } else {
        scale.value = withSpring(DOUBLE_TAP_SCALE, { damping: 20, stiffness: 200 });
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, panGesture),
    pinchGesture,
  );

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  function goTo(index: number) {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    setCurrentIndex(index);
  }

  const url = images[currentIndex] ?? null;
  const total = images.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        {/* 닫기 버튼 */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="close"
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* 이미지 */}
        <GestureDetector gesture={composed}>
          <View style={styles.imageArea}>
            {url ? (
              <Animated.Image
                source={{ uri: url }}
                style={[
                  {
                    width: baseW,
                    height: baseH,
                  },
                  imgStyle,
                ]}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </GestureDetector>

        {/* 좌우 이동 버튼 */}
        {total > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navBtn, styles.navLeft]}
                onPress={() => goTo(currentIndex - 1)}
                hitSlop={12}
                accessibilityLabel="previous image"
                accessibilityRole="button"
              >
                <Text style={styles.navText}>‹</Text>
              </TouchableOpacity>
            )}
            {currentIndex < total - 1 && (
              <TouchableOpacity
                style={[styles.navBtn, styles.navRight]}
                onPress={() => goTo(currentIndex + 1)}
                hitSlop={12}
                accessibilityLabel="next image"
                accessibilityRole="button"
              >
                <Text style={styles.navText}>›</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* 하단 인디케이터 */}
        {total > 1 && (
          <View style={styles.indicator}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BLACK,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeText: {
    color: WHITE,
    fontSize: 22,
    fontWeight: "600",
  },
  imageArea: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    zIndex: 10,
    padding: 12,
    marginTop: -28,
  },
  navLeft: {
    left: 8,
  },
  navRight: {
    right: 8,
  },
  navText: {
    color: WHITE,
    fontSize: 40,
    fontWeight: "300",
    lineHeight: 44,
  },
  indicator: {
    position: "absolute",
    bottom: 36,
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: WHITE,
  },
});
