import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useGachaRoll } from "@/hooks/useGachaRoll";
import GachaRollModalView from "@/components/organisms/gacha/GachaRollModal.view";
import GachaRollRecordsModal from "@/components/organisms/gacha/GachaRollRecordsModal";
import { useAppSelector } from "@/store/hooks";
import { useGachaRollStats } from "@/hooks/useGachaRollStats";
import { SkeletonBone } from "@/components/ui/Skeleton";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import type { GachaRollResult, GachaProductWithShops } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_100,
  GRAY_200,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function RollScreen() {
  const { id, imageUrl: paramImageUrl } = useLocalSearchParams<{
    id: string;
    imageUrl?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const [productImageUrl, setProductImageUrl] = useState<string | null>(
    paramImageUrl ? decodeURIComponent(paramImageUrl) : null,
  );

  const { status, result, nextAvailableAt, errorMessage, roll } = useGachaRoll(
    id ?? "",
  );
  const { stats: rollStats, setStats: setRollStats } = useGachaRollStats(
    id ?? "",
    !!isLoggedIn,
  );
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    if (productImageUrl || !id) return;
    fetch(`${API_BASE}/api/gacha-products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const url = data?.official_image_url ?? null;
        if (url) setProductImageUrl(url);
      })
      .catch(() => {});
  }, [id, productImageUrl]);

  useEffect(() => {
    if (status === "result" && result) {
      setRollStats(result.stats);
    }
  }, [status, result, setRollStats]);

  // ─── 가챠 변경 모달 ───
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<GachaProductWithShops[]>(
    [],
  );
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const trimmed = pickerQuery.trim();
    if (!trimmed) {
      setPickerResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setPickerLoading(true);
      fetch(
        `${API_BASE}/api/gacha-products?q=${encodeURIComponent(trimmed)}&include_shops=true&limit=20`,
        { signal: ctrl.signal },
      )
        .then((r) => r.json())
        .then((data) =>
          setPickerResults((data.products ?? []) as GachaProductWithShops[]),
        )
        .catch(() => {})
        .finally(() => setPickerLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [pickerQuery, pickerOpen]);

  const closePicker = () => {
    setPickerOpen(false);
    setPickerQuery("");
    setPickerResults([]);
  };

  const selectGacha = (item: GachaProductWithShops) => {
    closePicker();
    const img = item.official_image_url;
    router.replace(
      `/roll/${item.id}${img ? `?imageUrl=${encodeURIComponent(img)}` : ""}` as never,
    );
  };

  return (
    <>
      <GachaRollModalView
        status={status}
        result={result}
        nextAvailableAt={nextAvailableAt}
        errorMessage={errorMessage}
        isLoggedIn={!!isLoggedIn}
        productImageUrl={productImageUrl}
        rollStats={rollStats}
        onRoll={roll}
        onClose={() => router.back()}
        onLoginRequired={() => {
          router.back();
          router.push("/login" as never);
        }}
        onChangeGacha={() => setPickerOpen(true)}
        onRecordsPress={() => setRecordsOpen(true)}
        asScreen
      />

      <GachaRollRecordsModal
        visible={recordsOpen}
        rollStats={rollStats}
        onClose={() => setRecordsOpen(false)}
      />

      {/* 가챠 변경 팝업 */}
      <Modal
        visible={pickerOpen}
        animationType="fade"
        transparent
        onRequestClose={closePicker}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={closePicker}
        />
        <View style={[styles.popupCenter, { paddingTop: insets.top + 60 }]}>
          <View style={styles.popup}>
            {/* 헤더 */}
            <View style={styles.popupHeader}>
              <Text style={styles.popupTitle}>
                {t("roll.changeGacha", { defaultValue: "가챠 변경" })}
              </Text>
              <TouchableOpacity onPress={closePicker} hitSlop={8}>
                <Ionicons name="close" size={20} color={TEXT_GRAY} />
              </TouchableOpacity>
            </View>

            {/* 검색 */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={TEXT_GRAY} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("roll.changeGachaPlaceholder", {
                  defaultValue: "상품 이름 검색...",
                })}
                placeholderTextColor={TEXT_GRAY}
                value={pickerQuery}
                onChangeText={setPickerQuery}
                returnKeyType="search"
                autoFocus
              />
              {pickerQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setPickerQuery("");
                    setPickerResults([]);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={TEXT_GRAY} />
                </TouchableOpacity>
              )}
            </View>

            {/* 결과 */}
            {pickerLoading ? (
              <View style={{ padding: 16, gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonRow}>
                    <SkeletonBone
                      width={56}
                      height={56}
                      borderRadius={8}
                      style={{ flexShrink: 0 } as any}
                    />
                    <View style={{ flex: 1, gap: 6 }}>
                      <SkeletonBone width="60%" height={14} />
                      <SkeletonBone width="40%" height={12} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                data={pickerResults}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.resultRow}
                    onPress={() => selectGacha(item)}
                  >
                    <GachaItemThumb url={item.official_image_url} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.name_ko ?? item.name}
                      </Text>
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {item.manufacturer}
                        {item.available_shop_count > 0
                          ? ` · ${item.available_shop_count}개 샵`
                          : ""}
                      </Text>
                    </View>
                    {item.id === id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={PRIMARY}
                      />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                ListEmptyComponent={
                  pickerQuery.trim().length > 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>
                        {t("map.searchEmpty")}
                      </Text>
                    </View>
                  ) : null
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  popupCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
  },
  popup: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 20,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    height: 40,
    backgroundColor: GRAY_100,
    borderRadius: 20,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    paddingVertical: 0,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  resultSub: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  sep: {
    height: 1,
    backgroundColor: GRAY_100,
    marginHorizontal: 16,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
});
