import { useState } from "react";
import { View, Image } from "react-native";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";

interface Props {
  url: string | null;
  size?: number;
  borderRadius?: number;
  accessibilityLabel?: string;
}

export default function GachaItemThumb({
  url,
  size = 56,
  borderRadius = 8,
  accessibilityLabel,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <GachaPlaceholder size={size} borderRadius={borderRadius} />
      {!!url && (
        <Image
          source={{ uri: url }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            borderRadius,
            opacity: loaded ? 1 : 0,
          }}
          resizeMode="cover"
          accessibilityLabel={accessibilityLabel}
          onLoad={() => setLoaded(true)}
        />
      )}
    </View>
  );
}
