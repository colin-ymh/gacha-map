"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-bottom: 32px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const BackButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  cursor: pointer;
  padding: 0;

  &:hover {
    opacity: 0.75;
  }
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const SaveButton = styled.button<{ $loading?: boolean }>`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ $loading, theme }) =>
    $loading ? theme.colors.gray400 : theme.colors.primary};
  cursor: ${({ $loading }) => ($loading ? "default" : "pointer")};
  padding: 0;

  &:hover {
    opacity: ${({ $loading }) => ($loading ? 1 : 0.75)};
  }
`;

const AvatarSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px 24px;
  gap: 12px;
`;

const AvatarWrapper = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  cursor: pointer;
`;

const AvatarCircle = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
  overflow: hidden;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const CameraOverlay = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #fff;
`;

const ChangePhotoText = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  padding: 0;
`;

const FormSection = styled.div`
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
`;

const InputRow = styled.div`
  position: relative;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 48px 12px 12px;
  background: #f9f9f9;
  border: 1px solid ${({ theme }) => theme.colors.gray100};
  border-radius: 8px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  box-sizing: border-box;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Counter = styled.span<{ $over?: boolean }>`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ $over, theme }) =>
    $over ? theme.colors.dangerText : theme.colors.gray400};
`;

const Toast = styled.div<{ $error?: boolean }>`
  margin: 16px 16px 0;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  background: ${({ $error, theme }) => ($error ? "#fff0f0" : "#f0fff4")};
  color: ${({ $error, theme }) =>
    $error ? theme.colors.dangerText : "#22863a"};
  border: 1px solid ${({ $error }) => ($error ? "#ffcccc" : "#c6f0d1")};
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

const ProfileEditPanel = () => {
  const t = useTranslations("profileEdit");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const res = await fetch("/api/users/profile");
      if (res.ok) {
        const { profile } = await res.json();
        setNickname(profile.nickname ?? profile.name ?? "");
        setAvatarUrl(
          profile.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        );
      }
    });
  }, []);

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
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

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

      const updates: Record<string, string> = { nickname };
      if (uploadedUrl) updates.avatar_url = uploadedUrl;

      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error();

      setToast({ msg: t("saveSuccess"), error: false });
      setPendingFile(null);
      setTimeout(() => router.back(), 1000);
    } catch {
      setToast({ msg: t("saveError"), error: true });
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = previewUrl ?? avatarUrl;

  return (
    <Wrapper>
      <TopBar>
        <BackButton onClick={() => router.back()}>← {t("back")}</BackButton>
        <Title>{t("title")}</Title>
        <SaveButton $loading={isSaving} onClick={handleSave}>
          {isSaving ? t("saving") : t("save")}
        </SaveButton>
      </TopBar>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <AvatarSection>
        <AvatarWrapper onClick={() => fileRef.current?.click()}>
          <AvatarCircle>
            {displayAvatar && <AvatarImg src={displayAvatar} alt="avatar" />}
          </AvatarCircle>
          <CameraOverlay>📷</CameraOverlay>
        </AvatarWrapper>
        <ChangePhotoText onClick={() => fileRef.current?.click()}>
          {t("changePhoto")}
        </ChangePhotoText>
      </AvatarSection>

      <FormSection>
        <Label htmlFor="nickname">{t("nicknameLabel")}</Label>
        <InputRow>
          <Input
            id="nickname"
            type="text"
            value={nickname}
            maxLength={20}
            placeholder={t("nicknamePlaceholder")}
            onChange={(e) => setNickname(e.target.value)}
          />
          <Counter $over={nickname.length > 20}>{nickname.length} / 20</Counter>
        </InputRow>
      </FormSection>

      {toast && <Toast $error={toast.error}>{toast.msg}</Toast>}
    </Wrapper>
  );
};

export default ProfileEditPanel;
