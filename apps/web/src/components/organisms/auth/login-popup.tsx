"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import LoginPopupView from "./login-popup.view";

interface LoginPopupProps {
  onClose: () => void;
  returnUrl?: string;
  title?: string;
  description?: string;
}

function isSafeReturnUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

export default function LoginPopup({
  onClose,
  returnUrl,
  title,
  description,
}: LoginPopupProps) {
  const safeReturnUrl =
    returnUrl &&
    typeof window !== "undefined" &&
    isSafeReturnUrl(returnUrl, window.location.origin)
      ? returnUrl
      : "/";

  function handleKakao() {
    if (typeof window !== "undefined") {
      window.location.href = `/api/auth/kakao?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
    }
  }

  function handleNaver() {
    if (typeof window !== "undefined") {
      window.location.href = `/api/auth/naver?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback?returnUrl=${encodeURIComponent(safeReturnUrl)}`
        : "/api/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function handleApple() {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback?returnUrl=${encodeURIComponent(safeReturnUrl)}`
        : "/api/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    });
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <LoginPopupView
      onClose={onClose}
      onKakao={handleKakao}
      onNaver={handleNaver}
      onGoogle={handleGoogle}
      onApple={handleApple}
      title={title}
      description={description}
    />
  );
}
