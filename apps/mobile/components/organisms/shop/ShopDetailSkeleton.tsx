import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonBone, SkeletonCircle } from "@/components/ui/Skeleton";
import { WHITE, BORDER, GRAY_200 } from "@/constants/colors";

export default function ShopDetailSkeleton() {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* 헤더: 뒤로가기 | flex공백 | heart | megaphone */}
      <View style={styles.header}>
        <SkeletonBone width={24} height={24} borderRadius={4} />
        <View style={{ flex: 1 }} />
        <SkeletonCircle size={22} style={{ marginRight: 8 }} />
        <SkeletonCircle size={22} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* 가게명 + 찜 수 */}
        <View style={styles.nameArea}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <SkeletonBone width="65%" height={22} style={{ flex: 1 }} />
            <SkeletonBone width={40} height={15} style={{ marginLeft: 8 }} />
          </View>
          <SkeletonBone
            width={70}
            height={20}
            borderRadius={9999}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* 기본 정보 영역 */}
        <View style={styles.infoArea}>
          {/* 주소 행 */}
          <View style={styles.infoRow}>
            <SkeletonBone width="70%" height={14} style={{ flex: 1 }} />
            <SkeletonBone
              width={42}
              height={26}
              borderRadius={6}
              style={{ marginLeft: 8 }}
            />
            <SkeletonBone
              width={58}
              height={26}
              borderRadius={6}
              style={{ marginLeft: 6 }}
            />
          </View>

          {/* 전화 행 */}
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <SkeletonBone width={64} height={13} style={{ marginRight: 8 }} />
            <SkeletonBone width="45%" height={14} style={{ flex: 1 }} />
            <SkeletonBone
              width={36}
              height={26}
              borderRadius={6}
              style={{ marginLeft: 6 }}
            />
            <SkeletonBone
              width={36}
              height={26}
              borderRadius={6}
              style={{ marginLeft: 6 }}
            />
          </View>

          {/* 운영시간 행 */}
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <SkeletonBone width={64} height={13} style={{ marginRight: 8 }} />
            <SkeletonBone width="50%" height={14} />
          </View>
        </View>

        {/* 탭바 */}
        <View style={styles.tabBar}>
          <View style={styles.tabItem}>
            <SkeletonBone
              width="60%"
              height={14}
              style={{ alignSelf: "center" }}
            />
            <View style={styles.tabActiveUnderline} />
          </View>
          <View style={styles.tabItem}>
            <SkeletonBone
              width="60%"
              height={14}
              style={{ alignSelf: "center" }}
            />
          </View>
        </View>

        {/* 상품 카드 */}
        <View style={{ paddingHorizontal: 16 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.productRow}>
              <SkeletonBone width={72} height={72} borderRadius={8} />
              <View style={styles.productInfo}>
                <SkeletonBone
                  width="70%"
                  height={15}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBone
                  width="45%"
                  height={13}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBone width="55%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 58,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_200,
  },
  nameArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  infoArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActiveUnderline: {
    height: 2,
    backgroundColor: BORDER,
    width: "60%",
    alignSelf: "center",
    marginTop: 8,
    borderRadius: 1,
  },
  productRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  productInfo: { flex: 1, justifyContent: "center" },
});
