"use client";

import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LoginFormView from "./login-form.view";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const hasError = searchParams.has("error");

  function handleKakao() {
    window.location.href = "/api/auth/kakao";
  }

  function handleNaver() {
    window.location.href = "/api/auth/naver";
  }

  async function handleGoogle() {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback`
        : "/api/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  return (
    <LoginFormView
      hasError={hasError}
      onKakao={handleKakao}
      onNaver={handleNaver}
      onGoogle={handleGoogle}
    />
  );
}
