import { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { useTranslation } from "react-i18next";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_BODY,
  THUMBNAIL_PLACEHOLDER,
  DANGER,
  GRAY_200,
} from "@/constants/colors";

interface ReviewCardViewProps {
  review: Review;
  isOwner: boolean;
  expanded: boolean;
  isLong: boolean;
  selectedImageIndex: number | null;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onImagePress: (index: number) => void;
  onCloseImage: () => void;
}

const THUMB_SIZE = 80;

function ReviewThumb({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 6, backgroundColor: THUMBNAIL_PLACEHOLDER, flexShrink: 0 }}>
      <Image
        source={{ uri: toThumbUrl(url) }}
        style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 6, opacity: loaded ? 1 : 0 }}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}

function toThumbUrl(url: string): string {
  return url.replace(/\.jpg(\?|$)/, "_thumb.jpg$1");
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
  onEdit,
  onDelete,
  onImagePress,
  onCloseImage,
}: ReviewCardViewProps) => {
  const { t } = useTranslation();
  const nickname = review.user?.nickname ?? t("review.anonymous");
  const avatarUrl = review.user?.avatar_url ?? null;
  const mainBadge = review.user?.main_badge ?? null;
  const initial = nickname.charAt(0).toUpperCase();

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
          <View style={styles.nameRow}>
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
            <Text style={styles.nickname}>{nickname}</Text>
          </View>
          <Text style={styles.date}>{formatDate(review.created_at)}</Text>
        </View>
        {isOwner && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={onEdit} hitSlop={8}>
              <Text style={styles.editBtn}>{t("review.edit")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={8}>
              <Text style={styles.deleteBtn}>{t("review.delete")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 텍스트 */}
      {review.content ? (
        <>
          <Text
            style={styles.content}
            numberOfLines={expanded || !isLong ? undefined : 4}
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

      {/* 이미지 썸네일 */}
      {review.image_urls.length > 0 && (
        <View style={styles.imageRow}>
          {review.image_urls.slice(0, 3).map((url, idx) => (
            <TouchableOpacity key={idx} onPress={() => onImagePress(idx)}>
              <ReviewThumb url={url} />
            </TouchableOpacity>
          ))}
        </View>
      )}

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
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GRAY_200,
  },
  avatarInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GRAY_200,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_GRAY,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: PRIMARY_BG,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgePillIcon: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  badgePillEmoji: {
    fontSize: 10,
  },
  badgePillName: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "600",
  },
  nickname: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  date: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    fontSize: 12,
    color: PRIMARY,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deleteBtn: {
    fontSize: 12,
    color: DANGER,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  content: {
    fontSize: 14,
    color: TEXT_BODY,
    lineHeight: 22,
    marginBottom: 6,
  },
  toggleBtn: {
    fontSize: 12,
    color: PRIMARY,
    marginBottom: 8,
  },
  imageRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
    backgroundColor: THUMBNAIL_PLACEHOLDER,
  },
});

export default ReviewCardView;
