import { describe, it, expect } from "vitest";
import { parseScanImageRef, SCAN_IMAGES_BUCKET } from "../scanImageUrl";

const REF = "https://abc.supabase.co/storage/v1/object";

describe("parseScanImageRef", () => {
  describe("우리 버킷 객체로 해석하는 값", () => {
    it("public URL에서 경로를 뽑는다", () => {
      expect(
        parseScanImageRef(`${REF}/public/${SCAN_IMAGES_BUCKET}/uid/1.jpg`),
      ).toEqual({ kind: "bucket", path: "uid/1.jpg" });
    });

    it("signed URL의 쿼리스트링을 떼어낸다", () => {
      expect(
        parseScanImageRef(
          `${REF}/sign/${SCAN_IMAGES_BUCKET}/uid/1.jpg?token=abc.def`,
        ),
      ).toEqual({ kind: "bucket", path: "uid/1.jpg" });
    });

    // 버킷 비공개 전환 시 저장 포맷이 이 형태로 바뀐다.
    // 마커가 "/scan-images/"라 접두사로 시작하는 문자열과는 매칭되지 않으므로
    // 별도 분기가 필요하다 — 이 케이스가 빠지면 버킷 이름이 경로에 남아
    // 파일을 찾지 못한다.
    it("버킷 접두사가 붙은 object path를 정규화한다", () => {
      expect(parseScanImageRef(`${SCAN_IMAGES_BUCKET}/uid/1.jpg`)).toEqual({
        kind: "bucket",
        path: "uid/1.jpg",
      });
    });

    it("앞에 슬래시가 붙은 버킷 경로도 정규화한다", () => {
      expect(parseScanImageRef(`/${SCAN_IMAGES_BUCKET}/uid/1.jpg`)).toEqual({
        kind: "bucket",
        path: "uid/1.jpg",
      });
    });

    it("버킷 접두사 없는 object path를 그대로 쓴다", () => {
      expect(parseScanImageRef("uid/1.jpg")).toEqual({
        kind: "bucket",
        path: "uid/1.jpg",
      });
    });

    it("퍼센트 인코딩을 디코드한다", () => {
      expect(
        parseScanImageRef(`${REF}/public/${SCAN_IMAGES_BUCKET}/uid/a%20b.jpg`),
      ).toEqual({ kind: "bucket", path: "uid/a b.jpg" });
    });

    it("중첩 경로를 보존한다", () => {
      expect(parseScanImageRef("uid/sub/1.jpg")).toEqual({
        kind: "bucket",
        path: "uid/sub/1.jpg",
      });
    });
  });

  describe("우리 버킷이 아닌 값", () => {
    it("외부 http(s) URL은 external로 분류한다 — 지울 파일이 없다", () => {
      expect(parseScanImageRef("https://example.com/foo.jpg")).toEqual({
        kind: "external",
      });
    });

    it("다른 버킷의 storage URL도 external이다", () => {
      expect(parseScanImageRef(`${REF}/public/shop-photos/x/1.jpg`)).toEqual({
        kind: "external",
      });
    });
  });

  describe("해석할 수 없는 값", () => {
    // unknown은 purge가 손대지 않고 넘기는 값이다. bucket으로 잘못 분류하면
    // 엉뚱한 경로를 지우려 하고, external로 잘못 분류하면 파일을 남긴 채
    // 참조만 끊어 고아 파일이 된다.
    it.each([
      ["빈 문자열", ""],
      ["공백만", "   "],
      ["슬래시 없는 문자열", "not-a-path"],
    ])("%s은 unknown이다", (_label, input) => {
      expect(parseScanImageRef(input)).toEqual({ kind: "unknown" });
    });

    it("버킷 경로가 비어 있으면 unknown이다", () => {
      expect(parseScanImageRef(`${REF}/public/${SCAN_IMAGES_BUCKET}/`)).toEqual(
        { kind: "unknown" },
      );
    });
  });
});
