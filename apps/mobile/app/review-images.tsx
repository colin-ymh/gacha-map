import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from "react-native";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  PRIMARY,
  THUMBNAIL_PLACEHOLDER,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;

export default function ReviewImagesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!shopId) return;
    fetch(`${API_BASE}/api/shops/${shopId}/reviews/images`)
      .then((res) => res.json())
      .then((data) => {
        setImageUrls(Array.isArray(data.images) ? data.images : []);
      })
      .catch(() => setImageUrls([]))
      .finally(() => setIsLoading(false));
  }, [shopId]);

  const handleImagePress = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>{t("review.viewPhotos")}</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : imageUrls.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("review.noPhotos")}</Text>
        </View>
      ) : (
        <FlatList
          data={imageUrls}
          keyExtractor={(item, idx) => `${item}-${idx}`}
          numColumns={COLUMNS}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => handleImagePress(index)}>
              <Image
                source={{ uri: item }}
                style={styles.cell}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ImageViewerModal
        images={imageUrls}
        initialIndex={selectedIndex ?? 0}
        visible={selectedIndex !== null}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: WHITE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
});
