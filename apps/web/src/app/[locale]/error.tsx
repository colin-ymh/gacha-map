"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "24px",
        gap: "16px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "16px", color: "#1A1A1A", fontWeight: 600 }}>
        오류가 발생했습니다
      </p>
      <p style={{ fontSize: "14px", color: "#888888" }}>
        잠시 후 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          borderRadius: "20px",
          border: "none",
          backgroundColor: "#E94B8C",
          color: "#ffffff",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
