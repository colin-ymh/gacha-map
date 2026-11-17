import { describe, it, expect } from "vitest";
import { validateBizReg, normalizeBizReg } from "../validateBizReg";

describe("validateBizReg", () => {
  // 실제 공개된 법인 사업자등록번호로 알고리즘을 고정한다.
  // 알고리즘을 건드렸는데 이 케이스가 깨지면 알고리즘이 틀린 것이다.
  it.each([
    ["124-81-00998", "삼성전자"],
    ["220-81-62517", "네이버"],
    ["120-81-47521", "카카오"],
  ])("실존 사업자번호 %s (%s) 를 통과시킨다", (value) => {
    expect(validateBizReg(value)).toBeNull();
  });

  it("하이픈이 없어도 통과한다", () => {
    expect(validateBizReg("1248100998")).toBeNull();
  });

  it("공백이 섞여도 통과한다", () => {
    expect(validateBizReg(" 124 81 00998 ")).toBeNull();
  });

  it("체크디지트가 틀리면 invalid_checksum", () => {
    // 마지막 자리만 8 -> 7 로 변경
    expect(validateBizReg("124-81-00997")).toBe("invalid_checksum");
  });

  it("체크섬이 맞지 않는 반복 숫자를 거부한다", () => {
    expect(validateBizReg("111-11-11111")).toBe("invalid_checksum");
    expect(validateBizReg("999-99-99999")).toBe("invalid_checksum");
  });

  it("전부 0은 체크섬상 유효하다 (알고리즘의 한계)", () => {
    // 체크섬은 오타 검출용이지 실존 검증이 아니다. 0000000000 도 통과한다.
    // 실존 여부는 증빙 서류 + 관리자 확인으로만 걸러진다.
    expect(validateBizReg("000-00-00000")).toBeNull();
  });

  it("자릿수가 모자라면 invalid_length", () => {
    expect(validateBizReg("124-81-0099")).toBe("invalid_length");
    expect(validateBizReg("")).toBe("invalid_length");
  });

  it("자릿수가 넘치면 invalid_length", () => {
    expect(validateBizReg("124-81-009981")).toBe("invalid_length");
  });

  it("숫자가 아닌 문자만 있으면 invalid_length", () => {
    expect(validateBizReg("사업자등록번호")).toBe("invalid_length");
  });
});

describe("normalizeBizReg", () => {
  it("숫자만 남긴다", () => {
    expect(normalizeBizReg("124-81-00998")).toBe("1248100998");
    expect(normalizeBizReg(" 124 81 00998 ")).toBe("1248100998");
  });
});
