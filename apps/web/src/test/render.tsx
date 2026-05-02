import React from "react";
import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

export function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

export { screen, fireEvent, waitFor, act } from "@testing-library/react";
