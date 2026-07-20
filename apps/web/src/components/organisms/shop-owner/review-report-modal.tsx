"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ReviewReportModalView from "./review-report-modal.view";

export type ReviewReportReason =
  "spam" | "abusive" | "irrelevant" | "fake" | "other";

interface ReviewReportModalProps {
  reviewId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewReportModal({
  reviewId,
  onClose,
  onSubmitted,
}: ReviewReportModalProps) {
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailValid = detail.trim().length >= 10 && detail.trim().length <= 500;
  const canSubmit =
    reason !== null && (reason !== "other" || detailValid) && !isSubmitting;

  const handleSubmit = async () => {
    if (!reviewId || !canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");

      const res = await fetch(`/api/shop-owner/reviews/${reviewId}/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
          reason_detail: reason === "other" ? detail.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error();

      setReason(null);
      setDetail("");
      onSubmitted();
    } catch {
      setError("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason(null);
    setDetail("");
    setError(null);
    onClose();
  };

  return (
    <ReviewReportModalView
      visible={reviewId !== null}
      reason={reason}
      detail={detail}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      error={error}
      onReasonChange={setReason}
      onDetailChange={setDetail}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />
  );
}
