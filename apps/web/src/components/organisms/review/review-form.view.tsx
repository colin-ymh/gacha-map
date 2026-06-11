"use client";

import Image from "next/image";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { MODAL_OVERLAY_DARK } from "@/styles/color";

// ── Styled ──────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${MODAL_OVERLAY_DARK};
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;

  @media (min-width: 768px) {
    align-items: center;
  }
`;

const Sheet = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (min-width: 768px) {
    border-radius: 16px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const CancelButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
  padding: 4px;
  min-width: 48px;

  &:hover {
    color: ${({ theme }) => theme.colors.gray900};
  }
`;

const Title = styled.h2`
  flex: 1;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const SubmitButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  padding: 4px;
  min-width: 48px;
  text-align: right;

  &:disabled {
    color: ${({ theme }) => theme.colors.gray400};
    cursor: default;
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 140px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  background: ${({ theme }) => theme.colors.white};
  resize: none;
  line-height: 1.6;
  box-sizing: border-box;
  font-family: inherit;

  &::placeholder {
    color: ${({ theme }) => theme.colors.gray400};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const CharCount = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  text-align: right;
  margin: -12px 0 0 0;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  margin: 0;
`;

const PhotoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PhotoLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const PhotoRow = styled.div`
  display: flex;
  gap: 8px;
`;

const AddPhotoButton = styled.label`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.gray50};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.gray400};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const PreviewWrapper = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
`;

const RemovePhotoButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${MODAL_OVERLAY_DARK};
  border: none;
  cursor: pointer;
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;

const Hint = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
`;

const ErrorText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.dangerText};
  margin: 0;
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface ReviewFormViewProps {
  editMode?: boolean;
  content: string;
  previews: string[];
  isSubmitting: boolean;
  error: string | null;
  onContentChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const MAX_FILES = 3;
const MAX_CONTENT = 500;

const ReviewFormView = ({
  editMode,
  content,
  previews,
  isSubmitting,
  error,
  onContentChange,
  onFilesChange,
  onRemovePhoto,
  onCancel,
  onSubmit,
}: ReviewFormViewProps) => {
  const t = useTranslations("review");

  const canSubmit =
    !isSubmitting && (content.trim().length > 0 || previews.length > 0);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onFilesChange(files);
    e.target.value = "";
  };

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <Sheet>
        <Header>
          <CancelButton onClick={onCancel}>{t("formCancel")}</CancelButton>
          <Title>{editMode ? t("editTitle") : t("formTitle")}</Title>
          <SubmitButton onClick={onSubmit} disabled={!canSubmit}>
            {t("formSubmit")}
          </SubmitButton>
        </Header>

        <Body>
          <TextArea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={t("formPlaceholder")}
            maxLength={MAX_CONTENT}
          />
          <CharCount>{t("charCount", { current: content.length })}</CharCount>

          <Divider />

          <PhotoSection>
            <PhotoLabel>{t("formPhotoLabel")}</PhotoLabel>
            <PhotoRow>
              {previews.map((src, idx) => (
                <PreviewWrapper key={src}>
                  <Image
                    src={src}
                    alt={`preview-${idx + 1}`}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                  <RemovePhotoButton
                    type="button"
                    onClick={() => onRemovePhoto(idx)}
                  >
                    ×
                  </RemovePhotoButton>
                </PreviewWrapper>
              ))}
              {previews.length < MAX_FILES && (
                <AddPhotoButton>
                  +
                  <HiddenInput
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileInput}
                  />
                </AddPhotoButton>
              )}
            </PhotoRow>
            <Hint>{t("formRequiredHint")}</Hint>
            {error && <ErrorText>{error}</ErrorText>}
          </PhotoSection>
        </Body>
      </Sheet>
    </Overlay>
  );
};

export default ReviewFormView;
