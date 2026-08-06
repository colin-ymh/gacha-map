import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import * as ImageManipulator from "expo-image-manipulator";
import { useTranslation } from "react-i18next";
import { WHITE, BLACK, PRIMARY, TEXT_DARK } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W } = Dimensions.get("window");
const VP = SCREEN_W; // square viewport side (crop frame)
const OUTPUT_SIZE = 1000; // exported square size in px
const MAX_SCALE = 4;

type Props = {
  visible: boolean;
  sourceUri: string | null;
  onCancel: () => void;
  onConfirm: (uri: string) => void;
};

const clampJS = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

const ImageCropModal = ({ visible, sourceUri, onCancel, onConfirm }: Props) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const scale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const panStartTx = useSharedValue(0);
  const panStartTy = useSharedValue(0);

  // base display size that covers the square viewport at scale 1
  const bs = imgSize ? VP / Math.min(imgSize.w, imgSize.h) : 1;
  const baseW = imgSize ? imgSize.w * bs : VP;
  const baseH = imgSize ? imgSize.h * bs : VP;

  useEffect(() => {
    if (!sourceUri) {
      setImgSize(null);
      setDisplayUri(null);
      return;
    }
    scale.value = 1;
    pinchStartScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    panStartTx.value = 0;
    panStartTy.value = 0;
    setImgSize(null);
    setDisplayUri(null);
    let ignored = false;
    // Re-encode to bake EXIF orientation so the displayed pixels and the crop
    // coordinate space match (raw dimensions ignore EXIF rotation on Android).
    ImageManipulator.manipulateAsync(sourceUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    })
      .then((r) => {
        if (ignored) return;
        setImgSize({ w: r.width, h: r.height });
        setDisplayUri(r.uri);
      })
      .catch(() => {
        if (!ignored) {
          setImgSize(null);
          setDisplayUri(null);
        }
      });
    return () => {
      ignored = true;
    };
  }, [
    sourceUri,
    scale,
    pinchStartScale,
    tx,
    ty,
    panStartTx,
    panStartTy,
  ]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      "worklet";
      panStartTx.value = tx.value;
      panStartTy.value = ty.value;
    })
    .onUpdate((e) => {
      "worklet";
      const s = scale.value;
      const maxX = Math.max(0, (baseW * s - VP) / 2);
      const maxY = Math.max(0, (baseH * s - VP) / 2);
      tx.value = Math.min(
        maxX,
        Math.max(-maxX, panStartTx.value + e.translationX),
      );
      ty.value = Math.min(
        maxY,
        Math.max(-maxY, panStartTy.value + e.translationY),
      );
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      pinchStartScale.value = scale.value;
    })
    .onUpdate((e) => {
      "worklet";
      const s = Math.min(MAX_SCALE, Math.max(1, pinchStartScale.value * e.scale));
      scale.value = s;
      const maxX = Math.max(0, (baseW * s - VP) / 2);
      const maxY = Math.max(0, (baseH * s - VP) / 2);
      tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
      ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = async () => {
    if (!displayUri || !imgSize || processing) return;
    setProcessing(true);
    try {
      const s = scale.value;
      const dw = baseW * s;
      const dh = baseH * s;
      const factor = imgSize.w / dw; // original px per display px (== H/dh)
      const cropSize = VP * factor;
      const cropX = clampJS(
        (dw / 2 - VP / 2 - tx.value) * factor,
        0,
        imgSize.w - cropSize,
      );
      const cropY = clampJS(
        (dh / 2 - VP / 2 - ty.value) * factor,
        0,
        imgSize.h - cropSize,
      );
      const result = await ImageManipulator.manipulateAsync(
        displayUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropSize,
              height: cropSize,
            },
          },
          { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      onConfirm(result.uri);
    } catch {
      onCancel();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!processing) onCancel();
      }}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: BLACK }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: insets.top + 16,
              paddingBottom: 8,
            }}
          >
            <CropButton
              onPress={onCancel}
              disabled={processing}
            />
            <CropButton
              onPress={handleConfirm}
              disabled={processing || !imgSize}
              isLoading={processing}
              isConfirm
            />
          </View>

          <View style={{ flex: 1, justifyContent: "center" }}>
            <GestureDetector gesture={composed}>
              <View
                style={{
                  width: VP,
                  height: VP,
                  alignSelf: "center",
                  overflow: "hidden",
                  backgroundColor: BLACK,
                  borderWidth: 1,
                  borderColor: WHITE,
                }}
              >
                {displayUri && imgSize ? (
                  <Animated.Image
                    source={{ uri: displayUri }}
                    style={[
                      {
                        position: "absolute",
                        width: baseW,
                        height: baseH,
                        left: (VP - baseW) / 2,
                        top: (VP - baseH) / 2,
                      },
                      imgStyle,
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator color={WHITE} />
                  </View>
                )}
              </View>
            </GestureDetector>
            <Text
              style={{
                color: WHITE,
                textAlign: "center",
                marginTop: 24,
                fontSize: 13,
                opacity: 0.8,
              }}
            >
              {t("imageCrop.hint")}
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default ImageCropModal;

function CropButton({
  onPress,
  disabled,
  isLoading,
  isConfirm,
}: {
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isConfirm?: boolean;
}) {
  const { onPressIn, onPressOut, animatedStyle, brightnessValue } = useLiquidGlassPress();
  const color = isConfirm ? PRIMARY : WHITE;
  return (
    <LiquidGlass
      borderRadius={20}
      style={[animatedStyle, { opacity: disabled && !isLoading ? 0.4 : 1 }]}
      brightnessOpacity={brightnessValue}
      overlayColor={isConfirm ? "rgba(233,75,140,0.25)" : "rgba(255,255,255,0.15)"}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        activeOpacity={1}
        style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={isConfirm ? "checkmark" : "close"} size={22} color={color} />
        )}
      </TouchableOpacity>
    </LiquidGlass>
  );
}
