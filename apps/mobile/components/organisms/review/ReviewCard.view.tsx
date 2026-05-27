import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_BODY,
  BORDER,
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
  const nickname = review.user?.nickname ?? "익명";
  const avatarUrl = review.user?.avatar_url ?? null;
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
          <Text style={styles.nickname}>{nickname}</Text>
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
              <Image
                source={{ uri: toThumbUrl(url) }}
                style={styles.thumb}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 전체화면 이미지 뷰어 */}
      {selectedImageIndex !== null && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={onCloseImage}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={onCloseImage}
          >
            <Image
              source={{ uri: review.image_urls[selectedImageIndex] }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
  nickname: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  date: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: "100%",
    height: "80%",
  },
});

export default ReviewCardView;
