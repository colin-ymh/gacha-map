"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, CameraIcon } from "@/components/atoms/icons";

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
  background: ${({ theme }) => theme.colors.gray50};
  border: 1px solid ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
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
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  font-size: ${({ theme }) => theme.fontSize.sm};
  background: ${({ $error }) => ($error ? "#fff0f0" : "#f0fff4")};
  color: ${({ $error, theme }) =>
    $error ? theme.colors.dangerText : "#22863a"};
  border: 1px solid ${({ $error }) => ($error ? "#ffcccc" : "#c6f0d1")};
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface ProfileEditPanelViewProps {
  nickname: string;
  displayAvatar: string | null;
  isSaving: boolean;
  toast: { msg: string; error: boolean } | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onSave: () => void;
  onNicknameChange: (value: string) => void;
  onAvatarClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProfileEditPanelView = ({
  nickname,
  displayAvatar,
  isSaving,
  toast,
  fileRef,
  onBack,
  onSave,
  onNicknameChange,
  onAvatarClick,
  onFileChange,
}: ProfileEditPanelViewProps) => {
  const t = useTranslations("profileEdit");

  return (
    <Wrapper>
      <TopBar>
        <BackButton onClick={onBack}>
          <ArrowLeftIcon size={16} />
        </BackButton>
        <Title>{t("title")}</Title>
        <SaveButton $loading={isSaving} onClick={onSave}>
          {isSaving ? t("saving") : t("save")}
        </SaveButton>
      </TopBar>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      <AvatarSection>
        <AvatarWrapper onClick={onAvatarClick}>
          <AvatarCircle>
            <AvatarImg
              src={displayAvatar ?? "/images/avatar-placeholder.svg"}
              alt="avatar"
            />
          </AvatarCircle>
          <CameraOverlay>
            <CameraIcon size={14} />
          </CameraOverlay>
        </AvatarWrapper>
        <ChangePhotoText onClick={onAvatarClick}>
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
            onChange={(e) => onNicknameChange(e.target.value)}
          />
          <Counter $over={nickname.length > 20}>{nickname.length} / 20</Counter>
        </InputRow>
      </FormSection>

      {toast && <Toast $error={toast.error}>{toast.msg}</Toast>}
    </Wrapper>
  );
};

export default ProfileEditPanelView;
