import { containsProfanity } from "./containsProfanity";

const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]+$/;

export type NicknameError =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "profanity";

export function validateNickname(nickname: string): NicknameError | null {
  if (nickname.length < 2) return "too_short";
  if (nickname.length > 9) return "too_long";
  if (!NICKNAME_PATTERN.test(nickname)) return "invalid_chars";
  if (containsProfanity(nickname)) return "profanity";
  return null;
}
