import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { BlurViewCompat as BlurView } from "@/components/ui/BlurViewCompat";
import { GRAY_200, PRIMARY, BLACK } from "@/constants/colors";

const TRACK_W = 51;
const TRACK_H = 31;
const THUMB = 27;
const THUMB_OFF = 2;
const THUMB_ON = TRACK_W - THUMB - 2;

interface GlassSwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
}

export function GlassSwitch({ value, onValueChange }: GlassSwitchProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: true,
      bounciness: 6,
      speed: 16,
    }).start();
  }, [value]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_OFF, THUMB_ON],
  });

  return (
    <Pressable onPress={() => onValueChange(!value)} hitSlop={8}>
      <View style={styles.track}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.trackOn, { opacity: anim }]} />
        <Animated.View style={{ transform: [{ translateX }] }}>
          <Animated.View style={styles.thumb}>
            <View style={styles.thumbInner}>
              <BlurView style={StyleSheet.absoluteFill} intensity={30} tint="systemUltraThinMaterialLight" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.78)" }]} />
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: GRAY_200,
    overflow: "hidden",
    justifyContent: "center",
  },
  trackOn: {
    backgroundColor: PRIMARY,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbInner: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: "hidden",
  },
});
