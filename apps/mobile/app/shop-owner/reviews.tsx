import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/supabase";
import { SkeletonBone, SkeletonCircle } from "@/components/ui/Skeleton";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
  WHITE,
  THUMBNAIL_PLACEHOLDER,
  TEXT_PLACEHOLDER,
} from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import ReviewReportModal from "@/components/organisms/ReviewReportModal";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const PAGE_SIZE = 20;

interface ReviewUser {
  nickname: string | null;
  avatar_url: string | null;
}

interface Review {
  id: string;
  content: string | null;
  image_urls: string[];
  created_at: string;
  user_id: string;
  user?: ReviewUser | null;
}

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

export default function ShopOwnerReviewsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const tR = (key: string, opts?: Record<string, unknown>) =>
    t(`shopOwner.reviews.${key}`, opts);

  const fetchReviews = useCallback(
    async (currentOffset: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else {
        setIsLoading(true);
        setHasError(false);
      }

      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/shop-owner/reviews?offset=${currentOffset}&limit=${PAGE_SIZE}`,
          { headers: authHeaders },
        );
        if (!res.ok) throw new Error();

        const data = await res.json();
        const newReviews: Review[] = (data.reviews ?? []).map(
          (r: Review & { user_profiles?: ReviewUser }) => ({
            ...r,
            user: r.user_profiles ?? r.user ?? null,
          }),
        );

        if (append) {
          setReviews((prev) => [...prev, ...newReviews]);
        } else {
          setReviews(newReviews);
        }
        setTotal(data.total ?? 0);
        setOffset(currentOffset + newReviews.length);
      } catch {
        if (!append) setHasError(true);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    queueMicrotask(() => fetchReviews(0, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMore = offset < total;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: GRAY_100 }}
    >
      <View
        style={[styles.floatRow, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, padding: 16, paddingTop: 64 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <SkeletonCircle size={36} />
                <View style={{ flex: 1, marginLeft: 8, gap: 4 }}>
                  <SkeletonBone width="40%" height={14} />
                  <SkeletonBone width="25%" height={11} />
                </View>
              </View>
              <SkeletonBone
                width="90%"
                height={13}
                style={{ marginBottom: 4 }}
              />
              <SkeletonBone width="70%" height={13} />
            </View>
          ))}
        </View>
      ) : hasError ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            paddingTop: 64,
          }}
        >
          <TouchableOpacity
            onPress={() => fetchReviews(0, false)}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: PRIMARY,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: WHITE }}>
              {tR("retry")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : reviews.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            paddingTop: 64,
          }}
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>{tR("empty")}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingVertical: 8, paddingTop: 64 }}>
            {reviews.map((review) => (
              <View
                key={review.id}
                style={{
                  marginHorizontal: 16,
                  marginVertical: 6,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: GRAY_200,
                  backgroundColor: WHITE,
                  gap: 8,
                }}
              >
                {/* 작성자 */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: THUMBNAIL_PLACEHOLDER,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {review.user?.avatar_url ? (
                      <Image
                        source={{ uri: review.user.avatar_url }}
                        style={{ width: 28, height: 28 }}
                        resizeMode="cover"
                        accessibilityLabel=""
                      />
                    ) : (
                      <Ionicons
                        name="person"
                        size={14}
                        color={TEXT_PLACEHOLDER}
                      />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: TEXT_DARK,
                    }}
                  >
                    {review.user?.nickname ?? review.user_id.slice(0, 8)}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginLeft: "auto",
                    }}
                  >
                    <Text style={{ fontSize: 11, color: TEXT_GRAY }}>
                      {formatDate(review.created_at)}
                    </Text>
                    {reportedIds.has(review.id) ? (
                      <Text style={{ fontSize: 11, color: TEXT_GRAY }}>
                        {tR("reportedLabel")}
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setReportTargetId(review.id)}
                      >
                        <Text style={{ fontSize: 11, color: PRIMARY }}>
                          {tR("reportBtn")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 내용 */}
                {review.content ? (
                  <Text
                    style={{ fontSize: 13, color: TEXT_DARK, lineHeight: 18 }}
                    numberOfLines={3}
                  >
                    {review.content}
                  </Text>
                ) : null}

                {/* 이미지 태그 */}
                {review.image_urls.length > 0 ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 4,
                        backgroundColor: GRAY_100,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: TEXT_GRAY }}>
                        {tR("imageCount", { count: review.image_urls.length })}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

            {hasMore && (
              <TouchableOpacity
                onPress={() => fetchReviews(offset, true)}
                disabled={isLoadingMore}
                style={{
                  marginHorizontal: 16,
                  marginVertical: 8,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: GRAY_200,
                  alignItems: "center",
                  opacity: isLoadingMore ? 0.6 : 1,
                }}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: TEXT_DARK,
                    }}
                  >
                    {tR("loadMore")}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      <ReviewReportModal
        visible={reportTargetId !== null}
        reviewId={reportTargetId}
        onClose={() => setReportTargetId(null)}
        onSubmitted={() => {
          if (reportTargetId) {
            setReportedIds((prev) => new Set(prev).add(reportTargetId));
          }
          setReportTargetId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  floatRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
});
