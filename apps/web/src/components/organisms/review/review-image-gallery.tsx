"use client";

import { useState, useEffect } from "react";
import ReviewImageGalleryView from "./review-image-gallery.view";

interface ReviewImageGalleryProps {
  shopId: string;
  onBack: () => void;
}

const ReviewImageGallery = ({ shopId, onBack }: ReviewImageGalleryProps) => {
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/shops/${shopId}/reviews/images`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setImages(data.images ?? []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  return (
    <ReviewImageGalleryView
      images={images}
      isLoading={isLoading}
      onBack={onBack}
    />
  );
};

export default ReviewImageGallery;
