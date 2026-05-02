"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateProfileAsync } from "@/store/slices/auth.slice";
import ProfileEditPanelView from "./profile-edit-panel.view";

function resizeToSquare(file: File, size = 300, quality = 0.75): Promise<File> {
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

    resizeToSquare(file).then((resized) => {
      setPendingFile(resized);
      setPreviewUrl(URL.createObjectURL(resized));
      setToast(null);
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setToast(null);

    try {
      let uploadedUrl = avatarUrl;

      if (pendingFile) {
        if (!user?.id) throw new Error("Unauthorized");
        const supabase = createClient();
        const path = `${user.id}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        uploadedUrl = urlData.publicUrl;
      }

      const updates: { nickname: string; avatar_url?: string } = { nickname };
      if (uploadedUrl) updates.avatar_url = uploadedUrl;

      const result = await dispatch(updateProfileAsync(updates));
      if (updateProfileAsync.rejected.match(result)) throw new Error();

      setToast({ msg: t("saveSuccess"), error: false });
      setPendingFile(null);
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
