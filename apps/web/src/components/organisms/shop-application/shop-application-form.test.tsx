import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { afterEach, expect, it, vi } from "vitest";
import { theme } from "@/styles/theme";
import ShopApplicationForm from "./shop-application-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps the draft and attachments when switching to an existing shop", async () => {
  const fetchMock = vi.fn(async (...[url]: [string, RequestInit?]) => ({
    ok: true,
    json: async () => url.includes("shop-candidates")
      ? {
          candidates: [
            { id: "hongdae-id", name: "가챠코너 홍대점", address: "마포구", claimable: true },
            { id: "gangnam-id", name: "가챠코너 강남점", address: "강남구", claimable: false },
            { id: "other-id", name: "가챠코너 세 번째 지점", address: null, claimable: true },
            { id: "last-id", name: "가챠코너 네 번째 지점", address: null, claimable: true },
          ],
        }
      : {},
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:test-document"; }
    static revokeObjectURL() {}
  });

  const { container } = render(
    <ThemeProvider theme={theme}>
      <ShopApplicationForm onBack={() => {}} />
    </ThemeProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText("bizRegPlaceholder"), {
    target: { value: "1248100998" },
  });
  fireEvent.change(screen.getByPlaceholderText("repNamePlaceholder"), {
    target: { value: "테스트 신청자" },
  });
  fireEvent.change(screen.getByPlaceholderText("phonePlaceholder"), {
    target: { value: "01012345678" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [new File(["document"], "test.pdf", { type: "application/pdf" })] },
  });
  fireEvent.change(screen.getByPlaceholderText("shopNamePlaceholder"), {
    target: { value: "가챠코너" },
  });

  expect(await screen.findByText("candidateHeading")).toBeVisible();
  expect(screen.queryByRole("button", { name: /강남점/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /세 번째 지점/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /네 번째 지점/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "candidateContinue" })).not.toBeInTheDocument();
  const shopName = screen.getByPlaceholderText("shopNamePlaceholder");
  fireEvent.keyDown(shopName, { key: "Escape" });
  expect(screen.queryByRole("button", { name: /홍대점/ })).not.toBeInTheDocument();
  fireEvent.change(shopName, { target: { value: "가챠코너 " } });
  fireEvent.click(screen.getByRole("button", { name: /홍대점/ }));
  expect(screen.getByText("마포구")).toBeVisible();
  expect(document.getElementById("shop-application-name")).toHaveTextContent("가챠코너 홍대점");
  expect(screen.getByRole("button", { name: "documentsRemove" })).toBeVisible();
  expect(screen.getByPlaceholderText("repNamePlaceholder")).toHaveValue("테스트 신청자");
  expect(screen.queryByPlaceholderText("shopNamePlaceholder")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "candidateChange" }));
  expect(screen.getByPlaceholderText("shopNamePlaceholder")).toHaveValue("가챠코너 ");
  expect(screen.getByRole("button", { name: "documentsRemove" })).toBeVisible();

  fireEvent.focus(screen.getByPlaceholderText("shopNamePlaceholder"));
  fireEvent.click(await screen.findByRole("button", { name: /홍대점/ }));
  fireEvent.click(screen.getByRole("button", { name: "submitClaim" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/shop-applications",
    expect.objectContaining({ method: "POST" }),
  ));
  const post = fetchMock.mock.calls.find(([url]) => url === "/api/shop-applications");
  const body = post?.[1]?.body;
  expect(body).toBeInstanceOf(FormData);
  const form = body as FormData;
  expect(JSON.parse(String(form.get("payload")))).toMatchObject({
    type: "claim_shop",
    shop_id: "hongdae-id",
    shop_name: null,
    address: null,
    representative_name: "테스트 신청자",
  });
  expect(JSON.parse(String(form.get("payload")))).not.toHaveProperty("lat");
  expect(form.getAll("documents")).toHaveLength(1);
});
