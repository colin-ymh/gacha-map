import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { render } from "@/test/render";
import SearchBar from "../search-bar";

// vi.hoisted로 mock 변수를 먼저 생성해 호이스팅 이슈 방지
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const React = require("react");
    return React.createElement("a", { href, ...rest }, children);
  },
  useRouter: () => ({ push: mockPush }),
}));

describe("SearchBar", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("기본 렌더링: input과 submit 버튼이 있다", () => {
    render(<SearchBar />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("defaultValue가 input에 반영된다", () => {
    render(<SearchBar defaultValue="강남" />);
    expect(screen.getByRole("textbox")).toHaveValue("강남");
  });

  it("검색어 입력 후 submit 시 /search?q=검색어 로 push된다", () => {
    render(<SearchBar />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "강남샵" } });
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    // URLSearchParams가 한글을 percent-encoding하므로 디코딩 후 비교
    const calledUrl = mockPush.mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).toBe("/search?q=강남샵");
  });

  it("빈 검색어 submit 시 /search? (빈 파라미터)로 push된다", () => {
    render(<SearchBar />);
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    expect(mockPush).toHaveBeenCalledWith("/search?");
  });

  it("공백만 있는 검색어는 trim되어 빈 파라미터로 push된다", () => {
    render(<SearchBar />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    expect(mockPush).toHaveBeenCalledWith("/search?");
  });
});
