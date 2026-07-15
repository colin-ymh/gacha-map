import { useState } from "react";
import { View, Image } from "react-native";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";

export default function GachaItemThumb({ url }: { url: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width: 56, height: 56, flexShrink: 0 }}>
      <GachaPlaceholder size={56} borderRadius={8} />
      {!!url && (
        <Image
          source={{ uri: url }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 56,
            height: 56,
            borderRadius: 8,
            opacity: loaded ? 1 : 0,
          }}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
        />
      )}
    </View>
  );
}
