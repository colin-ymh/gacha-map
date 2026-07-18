import { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { useTranslation } from "react-i18next";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_BODY,
  GRAY_200,
} from "@/constants/colors";

interface ReviewCardViewProps {
  review: Review;
  isOwner: boolean;
  expanded: boolean;
  isLong: boolean;
  selectedImageIndex: number | null;
  onToggleExpand: () => void;
  onKebabOpen: (pageX: number, pageY: number) => void;
  onImagePress: (index: number) => void;
  onCloseImage: () => void;
}

const SCREEN_W = Dimensions.get("window").width;

function KebabButton({ onOpen }: { onOpen: (pageX: number, pageY: number) => void }) {
  const ref = useRef<View>(null);
  return (
    <TouchableOpacity
      onPress={() => {
        ref.current?.measureInWindow((x, y, _w, h) => {
          onOpen(x, y + h / 2);
        });
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View ref={ref}>
        <Ionicons name="ellipsis-vertical" size={18} color={TEXT_GRAY} />
      </View>
    </TouchableOpacity>
  );
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const ReviewCardView = ({
  review,
  isOwner,
  expanded,
  isLong,
  selectedImageIndex,
  onToggleExpand,
  onKebabOpen,
  onImagePress,
  onCloseImage,
}: ReviewCardViewProps) => {
  const { t } = useTranslation();
  const [carouselIndex, setCarouselIndex] = useState(0);

  const nickname = review.user?.nickname ?? t("review.anonymous");
  const avatarUrl = review.user?.avatar_url ?? null;
  const mainBadge = review.user?.main_badge ?? null;
  const initial = nickname.charAt(0).toUpperCase();
  const hasImages = review.image_urls.length > 0;

  return (
    <View style={styles.card}>
      {/* 헤더 */}
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarInitial}>
            <Text style={styles.avatarInitialText}>{initial}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.nickname}>{nickname}</Text>
          {mainBadge && (
            <View style={styles.badgePill}>
              {mainBadge.icon_url?.startsWith("http") ? (
                <Image
                  source={{ uri: mainBadge.icon_url }}
                  style={styles.badgePillIcon}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.badgePillEmoji}>
                  {mainBadge.icon_url || "🏅"}
                </Text>
              )}
              <Text style={styles.badgePillName}>{mainBadge.name}</Text>
            </View>
          )}
        </View>
        {isOwner && <KebabButton onOpen={onKebabOpen} />}
      </View>

      {/* 이미지 캐러셀 */}
      {hasImages && (
        <View style={styles.carouselWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicators={false}
            bounces={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_W,
              );
              setCarouselIndex(idx);
            }}
          >
            {review.image_urls.map((url, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.95}
                onPress={() => onImagePress(idx)}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {review.image_urls.length > 1 && (
            <View style={styles.dots}>
              {review.image_urls.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.dot, idx === carouselIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* 텍스트 캡션 */}
      <View style={styles.contentArea}>
        {review.content ? (
          <>
            <Text
              style={styles.content}
              numberOfLines={expanded || !isLong ? undefined : 3}
            >
              {review.content}
            </Text>
            {isLong && (
              <TouchableOpacity onPress={onToggleExpand}>
                <Text style={styles.toggleBtn}>
                  {expanded ? t("review.showLess") : t("review.showMore")}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : null}
        <Text style={styles.date}>{formatDate(review.updated_at)}</Text>
      </View>

      <ImageViewerModal
        images={review.image_urls}
        initialIndex={selectedImageIndex ?? 0}
        visible={selectedImageIndex !== null}
        onClose={onCloseImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GRAY_200,
  },
  avatarInitial: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GRAY_200,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_GRAY,
  },
  userInfo: {
    flex: 1,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
    backgroundColor: PRIMARY_BG,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  badgePillIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  badgePillEmoji: {
    fontSize: 11,
  },
  badgePillName: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "600",
  },
  nickname: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  date: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 6,
  },
  carouselWrap: {
    width: SCREEN_W,
  },
  carouselImage: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GRAY_200,
  },
  dotActive: {
    backgroundColor: PRIMARY,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  contentArea: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  content: {
    fontSize: 14,
    color: TEXT_BODY,
    lineHeight: 22,
  },
  toggleBtn: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GRAY_200,
  },
});

export default ReviewCardView;
