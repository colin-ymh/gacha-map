"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { containsProfanity } from "@gacha-map/shared";
import type { Review } from "@/types";
import ReviewFormView from "./review-form.view";

interface ReviewFormProps {
  shopId: string;
  editMode?: boolean;
  initialReview?: Review;
  onSuccess: (review: Review) => void;
  onCancel: () => void;
}

const ReviewForm = ({
  shopId,
  editMode,
  initialReview,
  onSuccess,
  onCancel,
}: ReviewFormProps) => {
  const t = useTranslations("review");
  const [content, setContent] = useState(initialReview?.content ?? "");
  const [keepUrls, setKeepUrls] = useState<string[]>(
    initialReview?.image_urls ?? [],
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allPreviews = [...keepUrls, ...newPreviews];

  const handleFilesChange = useCallback(
    (incoming: File[]) => {
      const remaining = 3 - (keepUrls.length + newFiles.length);
      const toAdd = incoming.slice(0, remaining);
      const newP = toAdd.map((f) => URL.createObjectURL(f));
      setNewFiles((prev) => [...prev, ...toAdd]);
      setNewPreviews((prev) => [...prev, ...newP]);
    },
    [keepUrls.length, newFiles.length],
  );

  const handleRemovePhoto = useCallback(
    (index: number) => {
      if (index < keepUrls.length) {
        setKeepUrls((prev) => prev.filter((_, i) => i !== index));
      } else {
        const newIdx = index - keepUrls.length;
        URL.revokeObjectURL(newPreviews[newIdx]);
        setNewFiles((prev) => prev.filter((_, i) => i !== newIdx));
        setNewPreviews((prev) => prev.filter((_, i) => i !== newIdx));
      }
    },
    [keepUrls.length, newPreviews],
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setError(null);

    if (content.trim() && containsProfanity(content.trim())) {
      setError(t("profanity"));
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (content.trim()) formData.append("content", content.trim());

      let res: Response;
      if (editMode && initialReview) {
        keepUrls.forEach((url) => formData.append("keepUrls[]", url));
        newFiles.forEach((f) => formData.append("files[]", f));
        res = await fetch(`/api/reviews/${initialReview.id}`, {
          method: "PATCH",
          body: formData,
        });
      } else {
        newFiles.forEach((f) => formData.append("files[]", f));
        res = await fetch(`/api/shops/${shopId}/reviews`, {
          method: "POST",
          body: formData,
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("submitError"));
      }

      const data = await res.json();
      newPreviews.forEach((p) => URL.revokeObjectURL(p));
      onSuccess(data.review as Review);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    content,
    editMode,
    initialReview,
    isSubmitting,
    keepUrls,
    newFiles,
    newPreviews,
    onSuccess,
    shopId,
    t,
  ]);

  return (
    <ReviewFormView
      editMode={editMode}
      content={content}
      previews={allPreviews}
      isSubmitting={isSubmitting}
      error={error}
      onContentChange={setContent}
      onFilesChange={handleFilesChange}
      onRemovePhoto={handleRemovePhoto}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    />
  );
};

export default ReviewForm;
