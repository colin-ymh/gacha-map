import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { GachaRollStats, GachaRollVariantStat } from "@gacha-map/shared";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import { WHITE, GRAY_200, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";

interface Props {
  visible: boolean;
  rollStats: GachaRollStats;
  onClose: () => void;
}

function RecordRow({ item }: { item: GachaRollVariantStat }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <GachaItemThumb url={item.variantImageUrl} size={44} borderRadius={8} />
      <Text style={styles.rowName} numberOfLines={1}>
        {item.variantNameKo ?? item.variantName}
      </Text>
      <Text style={styles.rowCount}>
        {t("gacha.roll.variantOwnedCount", { count: item.count })}
      </Text>
    </View>
  );
}

export default function GachaRollRecordsModal({
  visible,
  rollStats,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
      />
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t("gacha.roll.recordsTitle", { defaultValue: "뽑기 기록" })}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={TEXT_GRAY} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={rollStats.variantStats}
            keyExtractor={(item) => item.variantId}
            renderItem={({ item }) => <RecordRow item={item} />}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {t("gacha.roll.recordsEmpty", {
                    defaultValue: "아직 뽑은 상품이 없어요",
                  })}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
  },
  card: {
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  rowCount: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  sep: {
    height: 1,
    backgroundColor: GRAY_200,
    marginHorizontal: 16,
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
