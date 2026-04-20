"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MyReport } from "@/types";
import ReportsListView from "./reports-list.view";

interface ReportsListProps {
  onBack?: () => void;
}

const ReportsList = ({ onBack }: ReportsListProps) => {
  const router = useRouter();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setHasError(false);
    setIsLoading(true);
    fetch("/api/reports")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setReports(data.reports ?? []))
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsLoggedIn(false);
        setIsLoginPopupOpen(true);
        setIsLoading(false);
        return;
      }
      setIsLoggedIn(true);
      load();
    });
  }, []);

  const handleBack = () => {
    if (onBack) onBack();
    else router.push("/mypage");
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const loginReturnUrl =
    typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <ReportsListView
      reports={reports}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      hasError={hasError}
      isLoginPopupOpen={isLoginPopupOpen}
      expandedId={expandedId}
      onBack={handleBack}
      onRetry={load}
      onToggleExpand={handleToggleExpand}
      onNewReport={() => router.push("/report")}
      onLoginPopupClose={() => (onBack ? onBack() : router.back())}
      loginReturnUrl={loginReturnUrl}
    />
  );
};

export default ReportsList;
