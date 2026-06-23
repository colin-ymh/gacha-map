import "@testing-library/jest-dom";
import { vi } from "vitest";

// next-intl mock
vi.mock("next-intl", () => ({
  useLocale: () => "ko",
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
}));

// @/i18n/navigation mock
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
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// next/navigation mock
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// next/server mock (after() requires Next.js request scope)
vi.mock("next/server", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("next/server")>();
  return { ...original, after: vi.fn() };
});

// next/dynamic mock (NaverMap 등 dynamic import 컴포넌트)
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: unknown }>) => {
    const React = require("react");
    const Component = React.lazy(fn);
    return function DynamicComponent(props: unknown) {
      return React.createElement(
        React.Suspense,
        { fallback: null },
        React.createElement(Component as React.ElementType, props as object),
      );
    };
  },
}));
