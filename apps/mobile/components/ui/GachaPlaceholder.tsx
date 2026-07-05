import { View, StyleSheet } from "react-native";
import * as Colors from "@/constants/colors";

interface Props {
  size?: number;
  borderRadius?: number;
}

const GachaPlaceholder = ({ size = 56, borderRadius = 8 }: Props) => {
  const ballSize = Math.round(size * 0.64);
  const ballRadius = ballSize / 2;
  const seamH = 2;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius },
      ]}
    >
      {/* Gacha ball */}
      <View
        style={{
          width: ballSize,
          height: ballSize,
          borderRadius: ballRadius,
          overflow: "hidden",
        }}
      >
        {/* Top half — lighter */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: ballRadius - seamH / 2,
            backgroundColor: Colors.GRAY_300,
          }}
        />
        {/* Bottom half — darker */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: ballRadius - seamH / 2,
            backgroundColor: Colors.GRAY_400,
          }}
        />
        {/* Seam line */}
        <View
          style={{
            position: "absolute",
            top: ballRadius - seamH / 2,
            left: 0,
            right: 0,
            height: seamH,
            backgroundColor: Colors.GRAY_200,
          }}
        />
        {/* Shine dot */}
        <View
          style={{
            position: "absolute",
            top: Math.round(ballSize * 0.18),
            left: Math.round(ballSize * 0.22),
            width: Math.round(ballSize * 0.18),
            height: Math.round(ballSize * 0.12),
            borderRadius: 99,
            backgroundColor: "rgba(255,255,255,0.45)",
            transform: [{ rotate: "-30deg" }],
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.GRAY_100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export default GachaPlaceholder;
