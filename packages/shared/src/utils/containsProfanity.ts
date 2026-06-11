const PROFANITY_LIST: string[] = [
  "씨발",
  "시발",
  "ㅅㅂ",
  "개새끼",
  "개씨발",
  "병신",
  "ㅂㅅ",
  "좆",
  "보지",
  "자지",
  "애미",
  "니미",
  "느개비",
  "지랄",
  "미친놈",
  "미친년",
  "새끼",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "pussy",
];

export function containsProfanity(text: string): boolean {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  return PROFANITY_LIST.some((word) => normalized.includes(word));
}
