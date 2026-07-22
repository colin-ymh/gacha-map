import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import type { GachaProductWithShops } from "@gacha-map/shared";
import { WHITE, THUMBNAIL_PLACEHOLDER } from "@/constants/colors";

export const CARD_HEIGHT = 220;

interface GachaRollCardProps {
  item: GachaProductWithShops;
  width: number;
  onPress: () => void;
  onRollPress: () => void;
  onImageError: () => void;
}

function RollIconButton({ onPress }: { onPress: () => void }) {
  const { onPressIn, animatedStyle, brightnessValue } = useLiquidGlassPress();
  return (
    <LiquidGlass
      borderRadius={22}
      style={animatedStyle}
      brightnessOpacity={brightnessValue}
      overlayColor="rgba(233,75,140,0.15)"
    >
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onPress();
        }}
        onPressIn={onPressIn}
        activeOpacity={1}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="dice" size={22} color={WHITE} />
      </TouchableOpacity>
    </LiquidGlass>
  );
}

export default function GachaRollCard({
  item,
  width,
  onPress,
  onRollPress,
  onImageError,
}: GachaRollCardProps) {
  const displayName = item.name_ko ?? item.name_ja ?? item.name;

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {item.official_image_url ? (
        <Image
          source={{ uri: item.official_image_url }}
          style={styles.image}
          resizeMode="cover"
          onError={onImageError}
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.gradient}
      >
        <View style={styles.bottomRow}>
          <View style={styles.textCol}>
            <Text style={styles.name} numberOfLines={2}>
              {displayName}
            </Text>
          </View>
          <RollIconButton onPress={onRollPress} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 40,
    paddingBottom: 10,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  textCol: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: WHITE,
    lineHeight: 18,
  },
});
