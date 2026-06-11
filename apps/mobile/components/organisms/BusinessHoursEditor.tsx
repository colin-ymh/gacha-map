import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import type { BusinessHoursData, DayKey, DaySchedule } from "@gacha-map/shared";
import { DAY_KEYS, isValidTime } from "@gacha-map/shared";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_200,
  BORDER,
  WHITE,
  GRAY_100,
  DANGER_BG,
  DANGER_DARK,
} from "@/constants/colors";

interface Props {
  value: BusinessHoursData | null;
  onChange: (v: BusinessHoursData) => void;
}

const DEFAULT_SCHEDULE: DaySchedule = { open: "10:00", close: "21:00" };
const ALL_DAY_SCHEDULE: DaySchedule = { allDay: true, open: "", close: "" };

export default function BusinessHoursEditor({ value, onChange }: Props) {
  const { t } = useTranslation();
  const DAY_LABELS: Record<DayKey, string> = {
    mon: t("common.days.mon"),
    tue: t("common.days.tue"),
    wed: t("common.days.wed"),
    thu: t("common.days.thu"),
    fri: t("common.days.fri"),
    sat: t("common.days.sat"),
    sun: t("common.days.sun"),
  };
  const data: BusinessHoursData = value ?? { default: DEFAULT_SCHEDULE };

  const setDefault = (schedule: DaySchedule) => {
    onChange({ ...data, default: schedule });
  };

  const setOverride = (day: DayKey, schedule: DaySchedule | null) => {
    onChange({
      ...data,
      overrides: { ...data.overrides, [day]: schedule },
    });
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
    <View style={{ gap: 16 }}>
      {/* 기본 영업시간 */}
      <View
        style={{
          backgroundColor: WHITE,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: TEXT_GRAY }}>
          기본 영업시간
        </Text>

        <TimeRangeInput
          schedule={data.default ?? DEFAULT_SCHEDULE}
          onChange={setDefault}
        />
      </View>

      {/* 요일별 예외 */}
      <View
        style={{
          backgroundColor: WHITE,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: TEXT_GRAY }}>
          요일별 예외 설정
        </Text>

        {/* 요일 버튼 */}
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {DAY_KEYS.map((day) => {
            const active = !!(data.overrides && day in data.overrides);
            return (
              <TouchableOpacity
                key={day}
                onPress={() => toggleDayOverride(day)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? PRIMARY : GRAY_100,
                  borderWidth: active ? 0 : 1,
                  borderColor: GRAY_200,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: active ? WHITE : TEXT_GRAY,
                  }}
                >
                  {DAY_LABELS[day]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 예외 row 목록 */}
        {activeOverrides.length > 0 && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: GRAY_200,
              paddingTop: 12,
              gap: 12,
            }}
          >
            {activeOverrides.map((day) => {
              const schedule = data.overrides![day] ?? null;
              const isAllDay = schedule !== null && schedule?.allDay === true;
              const isClosed = schedule === null;

              return (
                <View key={day} style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: PRIMARY,
                        width: 20,
                      }}
                    >
                      {DAY_LABELS[day]}
                    </Text>

                    {isClosed ? (
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: GRAY_100,
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                          휴무
                        </Text>
                      </View>
                    ) : isAllDay ? (
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: GRAY_100,
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                          24시간
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <TimeRangeInput
                          schedule={schedule}
                          onChange={(s) => setOverride(day, s)}
                        />
                      </View>
                    )}

                    {/* 24시간 토글 */}
                    <TouchableOpacity
                      onPress={() =>
                        setOverride(
                          day,
                          isAllDay ? DEFAULT_SCHEDULE : ALL_DAY_SCHEDULE,
                        )
                      }
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 7,
                        borderRadius: 6,
                        backgroundColor: isAllDay ? PRIMARY_BG : GRAY_100,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: isAllDay ? PRIMARY : TEXT_GRAY,
                        }}
                      >
                        24시간
                      </Text>
                    </TouchableOpacity>

                    {/* 휴무 토글 */}
                    <TouchableOpacity
                      onPress={() =>
                        setOverride(day, isClosed ? DEFAULT_SCHEDULE : null)
                      }
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 6,
                        backgroundColor: isClosed ? DANGER_BG : GRAY_100,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: isClosed ? DANGER_DARK : TEXT_GRAY,
                        }}
                      >
                        휴무
                      </Text>
                    </TouchableOpacity>

                    {/* 삭제 */}
                    <TouchableOpacity
                      onPress={() => removeOverride(day)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 7,
                        borderRadius: 6,
                        backgroundColor: GRAY_100,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: TEXT_GRAY }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
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
}

function TimeRangeInput({ schedule, onChange }: TimeRangeInputProps) {
  if (schedule.allDay) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: GRAY_100,
            borderRadius: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 13, color: TEXT_GRAY }}>24시간</Text>
        </View>
        <TouchableOpacity
          onPress={() => onChange(DEFAULT_SCHEDULE)}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 7,
            borderRadius: 6,
            backgroundColor: GRAY_100,
          }}
        >
          <Text style={{ fontSize: 12, color: TEXT_GRAY }}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openErr =
    (schedule.open?.length ?? 0) === 5 && !isValidTime(schedule.open ?? "");
  const closeErr =
    (schedule.close?.length ?? 0) === 5 && !isValidTime(schedule.close ?? "");

  const timeInputStyle = (hasErr: boolean) => ({
    borderWidth: 1,
    borderColor: hasErr ? DANGER_DARK : BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_DARK,
    width: 72,
    textAlign: "center" as const,
    backgroundColor: WHITE,
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TextInput
        style={timeInputStyle(openErr)}
        value={schedule.open}
        onChangeText={(v) => onChange({ ...schedule, open: autoFormatTime(v) })}
        placeholder="10:00"
        placeholderTextColor={TEXT_GRAY}
        keyboardType="number-pad"
        maxLength={5}
      />
      <Text style={{ fontSize: 13, color: TEXT_GRAY }}>~</Text>
      <TextInput
        style={timeInputStyle(closeErr)}
        value={schedule.close}
        onChangeText={(v) =>
          onChange({ ...schedule, close: autoFormatTime(v) })
        }
        placeholder="21:00"
        placeholderTextColor={TEXT_GRAY}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <TouchableOpacity
        onPress={() => onChange(ALL_DAY_SCHEDULE)}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 7,
          borderRadius: 6,
          backgroundColor: PRIMARY_BG,
        }}
      >
        <Text style={{ fontSize: 12, color: PRIMARY }}>24시간</Text>
      </TouchableOpacity>
    </View>
  );
}
