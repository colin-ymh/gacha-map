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
          flexDirection: "column",
        }}
      >
        <View style={{ flex: 1, backgroundColor: Colors.GRAY_300 }} />
        <View style={{ height: seamH, backgroundColor: Colors.GRAY_200 }} />
        <View style={{ flex: 1, backgroundColor: Colors.GRAY_400 }} />
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
