"use client";

import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LoginFormView from "./login-form.view";

const isDev = process.env.NODE_ENV === "development";

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

  async function handleApple() {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback`
        : "/api/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    });
  }

  function handleDevAdmin() {
    window.location.href = "/api/dev/login?role=admin";
  }

  function handleDevUser() {
    window.location.href = "/api/dev/login?role=user";
  }

  return (
    <LoginFormView
      hasError={hasError}
      onKakao={handleKakao}
      onNaver={handleNaver}
      onGoogle={handleGoogle}
      onApple={handleApple}
      onDevAdmin={isDev ? handleDevAdmin : undefined}
      onDevUser={isDev ? handleDevUser : undefined}
    />
  );
}
