import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFeaturedGacha } from "@/hooks/useFeaturedGacha";
import { useAppSelector } from "@/store/hooks";
import GachaRollCard, { CARD_HEIGHT } from "@/components/molecules/gacha/GachaRollCard";
import GachaRollModal from "@/components/organisms/gacha/GachaRollModal";
import type { GachaProductWithShops } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_100,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
  GRAY_300,
} from "@/constants/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 20;
const CARD_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2) / 2.2);
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const AUTO_ADVANCE_MS = 3500;

export default function RollScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { items, loading, error } = useFeaturedGacha();
  const [erroredIds, setErroredIds] = useState<Set<string>>(new Set());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<GachaProductWithShops>>(null);

  const filteredItems = items.filter((item) => !erroredIds.has(item.id));

  const handleImageError = useCallback((id: string) => {
    setErroredIds((prev) => new Set([...prev, id]));
  }, []);

  useEffect(() => {
    if (filteredItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % filteredItems.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(interval);
  }, [filteredItems.length]);

  function handleCardPress(id: string) {
    router.push(`/gacha/${id}`);
  }

  function handleRollPress(id: string) {
    setSelectedProductId(id);
  }

  function handleModalClose() {
    setSelectedProductId(null);
  }

  function handleLoginRequired() {
    setSelectedProductId(null);
    router.push("/login");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("roll.title")}</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.statusText}>{t("roll.loading")}</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.statusText}>{t("roll.error")}</Text>
        </View>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.statusText}>{t("roll.empty")}</Text>
        </View>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <View>
          <FlatList<GachaProductWithShops>
            ref={flatListRef}
            data={filteredItems}
            horizontal
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / SNAP_INTERVAL,
              );
              setCurrentIndex(idx);
            }}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <GachaRollCard
                  item={item}
                  width={CARD_WIDTH}
                  onPress={() => handleCardPress(item.id)}
                  onRollPress={() => handleRollPress(item.id)}
                  onImageError={() => handleImageError(item.id)}
                />
              </View>
            )}
          />
          <View style={styles.dots}>
            {filteredItems.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      )}

      {selectedProductId && (
        <GachaRollModal
          productId={selectedProductId}
          isLoggedIn={!!isLoggedIn}
          onClose={handleModalClose}
          onLoginRequired={handleLoginRequired}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
  },
  header: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  list: {
    paddingHorizontal: H_PADDING,
  },
  cardWrapper: {
    marginRight: CARD_GAP,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GRAY_300,
  },
  dotActive: {
    backgroundColor: PRIMARY,
  },
  center: {
    height: CARD_HEIGHT + 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GRAY_100,
    marginHorizontal: H_PADDING,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
});
