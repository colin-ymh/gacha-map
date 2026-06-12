"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { BusinessHoursData, DayKey, DaySchedule } from "@gacha-map/shared";
import { DAY_KEYS, isValidTime } from "@gacha-map/shared";

const DEFAULT_SCHEDULE: DaySchedule = { open: "10:00", close: "21:00" };
const ALL_DAY_SCHEDULE: DaySchedule = { allDay: true, open: "", close: "" };

// ── Styled Components ────────────────────────────────────────────────────────

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CardLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TimeInput = styled.input<{ $error?: boolean }>`
  width: 72px;
  padding: 8px 10px;
  border: 1px solid
    ${({ $error, theme }) =>
      $error ? theme.colors.dangerText : theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  text-align: center;
  background-color: ${({ theme }) => theme.colors.white};

  &:focus {
    outline: none;
    border-color: ${({ $error, theme }) =>
      $error ? theme.colors.dangerText : theme.colors.primary};
  }
`;

const Separator = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const GrayBox = styled.div`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 8px 12px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const SmallBtn = styled.button<{
  $danger?: boolean;
  $active?: boolean;
  $primary?: boolean;
}>`
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.xs};
  background-color: ${({ theme, $danger, $active, $primary }) => {
    if ($danger && $active) return theme.colors.dangerBg;
    if ($primary && $active) return theme.colors.primaryBg;
    return theme.colors.gray100;
  }};
  color: ${({ theme, $danger, $active, $primary }) => {
    if ($danger && $active) return theme.colors.dangerText;
    if ($primary && $active) return theme.colors.primary;
    return theme.colors.textGray;
  }};
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.75;
  }
`;

const DayBtnRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const DayBtn = styled.button<{ $active: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: ${({ $active, theme }) =>
    $active ? "none" : `1px solid ${theme.colors.border}`};
  background-color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.gray100};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.white : theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    opacity: 0.8;
  }
`;

const OverrideDivider = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DayTag = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  width: 20px;
  flex-shrink: 0;
`;

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  value: BusinessHoursData | null;
  onChange: (v: BusinessHoursData) => void;
}

export default function BusinessHoursEditor({ value, onChange }: Props) {
  const t = useTranslations("shopOwner.profile.businessHours");
  const data: BusinessHoursData = value ?? { default: DEFAULT_SCHEDULE };

  const setDefault = (schedule: DaySchedule) => {
    onChange({ ...data, default: schedule });
  };

  const setOverride = (day: DayKey, schedule: DaySchedule | null) => {
    onChange({ ...data, overrides: { ...data.overrides, [day]: schedule } });
  };

  const removeOverride = (day: DayKey) => {
    const next = { ...data.overrides };
    delete next[day];
    onChange({
      ...data,
      overrides: Object.keys(next).length ? next : undefined,
    });
  };

  const toggleDayOverride = (day: DayKey) => {
    const hasOverride = data.overrides && day in data.overrides;
    if (hasOverride) {
      removeOverride(day);
    } else {
      setOverride(day, data.default ?? DEFAULT_SCHEDULE);
    }
  };

  const activeOverrides = DAY_KEYS.filter(
    (d) => data.overrides && d in data.overrides,
  );

  return (
    <Section>
      {/* 기본 영업시간 */}
      <Card>
        <CardLabel>{t("defaultLabel")}</CardLabel>

        <TimeRangeInput
          schedule={data.default ?? DEFAULT_SCHEDULE}
          onChange={setDefault}
          allDayLabel={t("allDayBtn")}
        />
      </Card>

      {/* 요일별 예외 */}
      <Card>
        <CardLabel>{t("overridesLabel")}</CardLabel>

        <DayBtnRow>
          {DAY_KEYS.map((day) => {
            const active = !!(data.overrides && day in data.overrides);
            return (
              <DayBtn
                key={day}
                $active={active}
                onClick={() => toggleDayOverride(day)}
                type="button"
              >
                {t(day)}
              </DayBtn>
            );
          })}
        </DayBtnRow>

        {activeOverrides.length > 0 && (
          <OverrideDivider>
            {activeOverrides.map((day) => {
              const schedule = data.overrides![day] ?? null;
              const isAllDay = schedule !== null && schedule?.allDay === true;
              const isClosed = schedule === null;

              return (
                <Row key={day}>
                  <DayTag>{t(day)}</DayTag>

                  {isClosed ? (
                    <GrayBox>{t("closedLabel")}</GrayBox>
                  ) : isAllDay ? (
                    <GrayBox>{t("allDayBtn")}</GrayBox>
                  ) : (
                    <TimeRangeInput
                      schedule={schedule}
                      onChange={(s) => setOverride(day, s)}
                      allDayLabel={t("allDayBtn")}
                    />
                  )}

                  <SmallBtn
                    $primary
                    $active={isAllDay}
                    type="button"
                    onClick={() =>
                      setOverride(
                        day,
                        isAllDay ? DEFAULT_SCHEDULE : ALL_DAY_SCHEDULE,
                      )
                    }
                  >
                    {isAllDay ? `✓ ${t("allDayBtn")}` : t("allDayBtn")}
                  </SmallBtn>

                  <SmallBtn
                    $danger
                    $active={isClosed}
                    type="button"
                    onClick={() =>
                      setOverride(day, isClosed ? DEFAULT_SCHEDULE : null)
                    }
                  >
                    {t("closedLabel")}
                  </SmallBtn>

                  <SmallBtn type="button" onClick={() => removeOverride(day)}>
                    {t("removeBtn")}
                  </SmallBtn>
                </Row>
              );
            })}
          </OverrideDivider>
        )}
      </Card>
    </Section>
  );
}

function autoFormatTime(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

interface TimeRangeInputProps {
  schedule: DaySchedule;
  onChange: (s: DaySchedule) => void;
  allDayLabel: string;
}

function TimeRangeInput({
  schedule,
  onChange,
  allDayLabel,
}: TimeRangeInputProps) {
  if (schedule.allDay) {
    return (
      <Row style={{ flex: 1 }}>
        <GrayBox>{allDayLabel}</GrayBox>
        <SmallBtn type="button" onClick={() => onChange(DEFAULT_SCHEDULE)}>
          ✕
        </SmallBtn>
      </Row>
    );
  }

  const openErr =
    (schedule.open?.length ?? 0) === 5 && !isValidTime(schedule.open ?? "");
  const closeErr =
    (schedule.close?.length ?? 0) === 5 && !isValidTime(schedule.close ?? "");

  return (
    <Row>
      <TimeInput
        $error={openErr}
        value={schedule.open}
        onChange={(e) =>
          onChange({ ...schedule, open: autoFormatTime(e.target.value) })
        }
        placeholder="10:00"
        maxLength={5}
        inputMode="numeric"
      />
      <Separator>~</Separator>
      <TimeInput
        $error={closeErr}
        value={schedule.close}
        onChange={(e) =>
          onChange({ ...schedule, close: autoFormatTime(e.target.value) })
        }
        placeholder="21:00"
        maxLength={5}
        inputMode="numeric"
      />
      <SmallBtn type="button" onClick={() => onChange(ALL_DAY_SCHEDULE)}>
        {allDayLabel}
      </SmallBtn>
    </Row>
  );
}
