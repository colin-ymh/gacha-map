"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { BadgeDefinition } from "@gacha-map/shared";
import { createClient } from "@/lib/supabase/client";

// ── Styled ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  border: 1px solid ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const SuccessMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.primaryBg};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSize.sm};
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
`;

const Th = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textGray};
  background: ${({ theme }) => theme.colors.gray50};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 10px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textDark};
  vertical-align: middle;
`;

const InlineInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const NumberInput = styled(InlineInput)`
  width: 80px;
`;

const SaveButton = styled.button`
  padding: 4px 12px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TrackBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  background: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textGray};
  white-space: nowrap;
`;

const TierDot = styled.span`
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  line-height: 20px;
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface EditState {
  name: string;
  description: string;
  icon_url: string;
  threshold: number;
}

export default function AdminBadgesPage() {
  const t = useTranslations("admin");
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/badges", {
          headers: session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (!res.ok) throw new Error("Failed to load badges");
        const data = await res.json();
        setBadges(data.badges);
        const initial: Record<string, EditState> = {};
        for (const b of data.badges as BadgeDefinition[]) {
          initial[b.id] = {
            name: b.name,
            description: b.description,
            icon_url: b.icon_url,
            threshold: b.threshold,
          };
        }
        setEdits(initial);
      } catch {
        setError(t("badges.loadError"));
      } finally {
        setIsLoading(false);
      }
    };
    fetchBadges();
  }, [t]);

  const handleChange = (
    id: string,
    field: keyof EditState,
    value: string | number,
  ) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (badge: BadgeDefinition) => {
    const edit = edits[badge.id];
    if (!edit) return;
    setSaving(badge.id);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/badges/${badge.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          name: edit.name,
          description: edit.description,
          icon_url: edit.icon_url,
          threshold: Number(edit.threshold),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? t("badges.saveError"));
      }
      const { badge: updated } = await res.json();
      setBadges((prev) =>
        prev.map((b) => (b.id === badge.id ? { ...b, ...updated } : b)),
      );
      setSuccess(t("badges.saveSuccess"));
      setTimeout(() => setSuccess(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("badges.saveError"));
    } finally {
      setSaving(null);
    }
  };

  const isDirty = (badge: BadgeDefinition) => {
    const e = edits[badge.id];
    if (!e) return false;
    return (
      e.name !== badge.name ||
      e.description !== badge.description ||
      e.icon_url !== badge.icon_url ||
      e.threshold !== badge.threshold
    );
  };

  if (isLoading) return <Container>{t("shops.loading")}</Container>;

  return (
    <Container>
      <Title>{t("nav.badges")}</Title>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
      <Table>
        <thead>
          <tr>
            <Th>{t("badges.tableTrack")}</Th>
            <Th>{t("badges.tableTier")}</Th>
            <Th>{t("badges.tableName")}</Th>
            <Th>{t("badges.tableDescription")}</Th>
            <Th>{t("badges.tableIcon")}</Th>
            <Th>{t("badges.tableThreshold")}</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {badges.map((badge) => {
            const edit = edits[badge.id];
            if (!edit) return null;
            return (
              <tr key={badge.id}>
                <Td>
                  <TrackBadge>{badge.track}</TrackBadge>
                </Td>
                <Td>
                  <TierDot>{badge.tier}</TierDot>
                </Td>
                <Td>
                  <InlineInput
                    value={edit.name}
                    onChange={(e) =>
                      handleChange(badge.id, "name", e.target.value)
                    }
                  />
                </Td>
                <Td>
                  <InlineInput
                    value={edit.description}
                    onChange={(e) =>
                      handleChange(badge.id, "description", e.target.value)
                    }
                  />
                </Td>
                <Td>
                  <InlineInput
                    value={edit.icon_url}
                    placeholder={t("badges.iconUrlPlaceholder")}
                    onChange={(e) =>
                      handleChange(badge.id, "icon_url", e.target.value)
                    }
                  />
                </Td>
                <Td>
                  <NumberInput
                    type="number"
                    min={0}
                    value={edit.threshold}
                    onChange={(e) =>
                      handleChange(badge.id, "threshold", e.target.value)
                    }
                  />
                </Td>
                <Td>
                  <SaveButton
                    onClick={() => handleSave(badge)}
                    disabled={!isDirty(badge) || saving === badge.id}
                  >
                    {saving === badge.id
                      ? t("badges.saving")
                      : t("badges.save")}
                  </SaveButton>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Container>
  );
}
