import React from "react";
import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { ThemeProvider } from "styled-components";
import { store } from "@/store/store";
import { theme } from "@/styles/theme";

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </Provider>
);

export function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

export { screen, fireEvent, waitFor, act } from "@testing-library/react";
