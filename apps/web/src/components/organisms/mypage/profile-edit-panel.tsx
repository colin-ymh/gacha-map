"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateProfileAsync } from "@/store/slices/auth.slice";
import ProfileEditPanelView from "./profile-edit-panel.view";

function resizeToSquare(file: File, size = 300, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob(
        (blob) =>
          resolve(
            new File([blob!], "avatar_thumb.jpg", { type: "image/jpeg" }),
          ),
        "image/jpeg",
        quality,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

function resizeDisplay(
  file: File,
  maxPx = 1200,
  quality = 0.85,
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = maxPx / Math.max(img.width, img.height);
      const w = scale < 1 ? Math.round(img.width * scale) : img.width;
      const h = scale < 1 ? Math.round(img.height * scale) : img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) =>
          resolve(new File([blob!], "avatar.jpg", { type: "image/jpeg" })),
        "image/jpeg",
        quality,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

const ProfileEditPanel = () => {
  const t = useTranslations("profileEdit");
  const router = useRouter();
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  const { profile, user } = useAppSelector((s) => s.auth);

  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDisplayFile, setPendingDisplayFile] = useState<File | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (hasInitialized.current || !profile) return;
    hasInitialized.current = true;
    queueMicrotask(() => {
      setNickname(profile.nickname ?? profile.name ?? "");
      setAvatarUrl(
        profile.avatar_url ?? user?.user_metadata?.avatar_url ?? null,
      );
    });
  }, [profile, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToast({ msg: t("imageSizeError"), error: true });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setToast({ msg: t("imageTypeError"), error: true });
      return;
    }

    Promise.all([resizeToSquare(file), resizeDisplay(file)]).then(
      ([thumb, display]) => {
        setPendingFile(thumb);
        setPendingDisplayFile(display);
        setPreviewUrl(URL.createObjectURL(display));
        setToast(null);
      },
    );
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setToast(null);

    try {
      let uploadedUrl = avatarUrl;
      let uploadedThumbUrl: string | undefined;

      if (pendingFile && pendingDisplayFile) {
        if (!user?.id) throw new Error("Unauthorized");
        const supabase = createClient();
        const displayPath = `${user.id}/avatar.jpg`;
        const thumbPath = `${user.id}/avatar_thumb.jpg`;

        const [displayUpload, thumbUpload] = await Promise.all([
          supabase.storage
            .from("avatars")
            .upload(displayPath, pendingDisplayFile, { upsert: true }),
          supabase.storage
            .from("avatars")
            .upload(thumbPath, pendingFile, { upsert: true }),
        ]);

        if (displayUpload.error) throw displayUpload.error;
        if (thumbUpload.error) throw thumbUpload.error;

        const ts = Date.now();
        const { data: displayUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(displayPath);
        const { data: thumbUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(thumbPath);

        uploadedUrl = `${displayUrlData.publicUrl}?t=${ts}`;
        uploadedThumbUrl = `${thumbUrlData.publicUrl}?t=${ts}`;
      }

      const updates: {
        nickname: string;
        avatar_url?: string;
        avatar_thumb_url?: string;
      } = { nickname };
      if (uploadedUrl) updates.avatar_url = uploadedUrl;
      if (uploadedThumbUrl) updates.avatar_thumb_url = uploadedThumbUrl;

      const result = await dispatch(updateProfileAsync(updates));
      if (updateProfileAsync.rejected.match(result)) throw new Error();

      setToast({ msg: t("saveSuccess"), error: false });
      setPendingFile(null);
      setPendingDisplayFile(null);
      setTimeout(() => router.back(), 1000);
    } catch {
      setToast({ msg: t("saveError"), error: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProfileEditPanelView
      nickname={nickname}
      displayAvatar={previewUrl ?? avatarUrl}
      isSaving={isSaving}
      toast={toast}
      fileRef={fileRef}
      onBack={() => router.back()}
      onSave={handleSave}
      onNicknameChange={setNickname}
      onAvatarClick={() => fileRef.current?.click()}
      onFileChange={handleFileChange}
    />
  );
};

export default ProfileEditPanel;
