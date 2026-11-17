/**
 * 사업자등록번호(10자리) 형식 검증.
 *
 * 국세청 체크섬 알고리즘:
 *   weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
 *   sum = Σ digits[i] * weights[i]   (i = 0..8)
 *   sum += floor(digits[8] * 5 / 10) // 9번째 자리의 십의 자리 올림
 *   check = (10 - (sum % 10)) % 10
 *   유효 ⟺ check === digits[9]
 *
 * ⚠️ 체크섬 통과는 '형식이 맞다'는 뜻일 뿐 **실존하는 사업자라는 보장이 아니다.**
 * 임의로 만든 숫자도 체크섬만 맞추면 통과한다. 실제 존재 여부는 국세청
 * 사업자등록상태 조회 API(공공데이터포털)로만 확인할 수 있으며, 현재는
 * 증빙 서류(사업자등록증) 첨부 + 관리자 육안 확인으로 대체한다.
 */

const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

export type BizRegError = "invalid_length" | "invalid_checksum";

export function validateBizReg(value: string): BizRegError | null {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 10) return "invalid_length";

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * WEIGHTS[i];
  }
  sum += Math.floor((Number(digits[8]) * 5) / 10);

  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(digits[9])) return "invalid_checksum";

  return null;
}

/** 하이픈 등을 제거한 정규화 값. DB의 biz_reg_digits 생성 컬럼과 동일한 규칙. */
export function normalizeBizReg(value: string): string {
  return value.replace(/\D/g, "");
}
