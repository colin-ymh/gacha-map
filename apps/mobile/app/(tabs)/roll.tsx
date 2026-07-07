import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFeaturedGacha } from "@/hooks/useFeaturedGacha";
import { useAppSelector } from "@/store/hooks";
import GachaRollCard from "@/components/molecules/gacha/GachaRollCard";
import GachaRollModal from "@/components/organisms/gacha/GachaRollModal";
import type { GachaProductWithShops } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_100,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
} from "@/constants/colors";

export default function RollScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { items, loading, error } = useFeaturedGacha();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

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

      {!loading && !error && items.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.statusText}>{t("roll.empty")}</Text>
        </View>
      )}

      {!loading && !error && items.length > 0 && (
        <View style={styles.carouselWrapper}>
          <FlatList<GachaProductWithShops>
            data={items}
            horizontal
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <GachaRollCard
                item={item}
                onPress={() => handleCardPress(item.id)}
                onRollPress={() => handleRollPress(item.id)}
              />
            )}
          />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  carouselWrapper: {
    height: 290,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GRAY_100,
  },
  statusText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
});
