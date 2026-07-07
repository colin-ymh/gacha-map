import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonBone, SkeletonCircle } from "@/components/ui/Skeleton";
import { WHITE, BORDER } from "@/constants/colors";

export default function ShopDetailSkeleton() {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <SkeletonCircle size={32} />
        <SkeletonBone width="50%" height={18} style={styles.headerTitle} />
        <SkeletonCircle size={32} />
      </View>

      <SkeletonBone height={220} borderRadius={0} />

      <ScrollView contentContainerStyle={styles.content}>
        <SkeletonBone width="60%" height={22} style={styles.gap8} />
        <SkeletonBone width="35%" height={14} style={styles.gap16} />

        <View style={styles.divider} />

        <SkeletonBone width="80%" height={14} style={styles.gap8} />
        <SkeletonBone width="65%" height={14} style={styles.gap8} />
        <SkeletonBone width="55%" height={14} style={styles.gap8} />
        <SkeletonBone width="70%" height={14} style={styles.gap24} />

        <View style={styles.tabRow}>
          <SkeletonBone width="48%" height={36} borderRadius={4} />
          <SkeletonBone width="48%" height={36} borderRadius={4} />
        </View>

        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.productRow}>
            <SkeletonBone width={72} height={72} borderRadius={8} />
            <View style={styles.productInfo}>
              <SkeletonBone width="70%" height={15} style={styles.gap6} />
              <SkeletonBone width="45%" height={13} style={styles.gap6} />
              <SkeletonBone width="55%" height={12} />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { flex: 1, marginHorizontal: 12 },
  content: { padding: 16, gap: 0 },
  gap6: { marginBottom: 6 },
  gap8: { marginBottom: 8 },
  gap16: { marginBottom: 16 },
  gap24: { marginBottom: 24 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  productRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  productInfo: { flex: 1, justifyContent: "center" },
});
