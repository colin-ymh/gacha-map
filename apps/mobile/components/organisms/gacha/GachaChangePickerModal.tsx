import { useEffect, useState } from "react";
import {
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
import { SkeletonBone } from "@/components/ui/Skeleton";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import type { GachaProductWithShops } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_100,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface Props {
  visible: boolean;
  currentId?: string;
  onClose: () => void;
  onSelect: (item: GachaProductWithShops) => void;
}

const GachaChangePickerModal = ({
  visible,
  currentId,
  onClose,
  onSelect,
}: Props) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GachaProductWithShops[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(
        `${API_BASE}/api/gacha-products?q=${encodeURIComponent(trimmed)}&include_shops=true&limit=20`,
        { signal: ctrl.signal },
      )
        .then((r) => r.json())
        .then((data) =>
          setResults((data.products ?? []) as GachaProductWithShops[]),
        )
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, visible]);

  const handleClose = () => {
    setQuery("");
    setResults([]);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={handleClose}
      />
      <View style={[styles.popupCenter, { paddingTop: insets.top + 60 }]}>
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>
              {t("roll.changeGacha", { defaultValue: "가챠 변경" })}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={TEXT_GRAY} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={TEXT_GRAY} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("roll.changeGachaPlaceholder", {
                defaultValue: "상품 이름 검색...",
              })}
              placeholderTextColor={TEXT_GRAY}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery("");
                  setResults([]);
                }}
              >
                <Ionicons name="close-circle" size={16} color={TEXT_GRAY} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
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
              data={results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => onSelect(item)}
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
                  {item.id === currentId && (
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
                query.trim().length > 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>{t("map.searchEmpty")}</Text>
                  </View>
                ) : null
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </View>
  );
};

export default GachaChangePickerModal;

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
