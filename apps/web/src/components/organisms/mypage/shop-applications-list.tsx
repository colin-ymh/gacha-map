"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ShopOwnerApplication } from "@/types";
import ShopApplicationsListView from "./shop-applications-list.view";

interface ShopApplicationsListProps {
  onBack?: () => void;
}

const ShopApplicationsList = ({ onBack }: ShopApplicationsListProps) => {
  const router = useRouter();
  const [applications, setApplications] = useState<ShopOwnerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  const load = () => {
    setHasError(false);
    setIsLoading(true);
    fetch("/api/shop-applications")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setApplications(data.applications ?? []))
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

  const loginReturnUrl =
    typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <ShopApplicationsListView
      applications={applications}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      hasError={hasError}
      isLoginPopupOpen={isLoginPopupOpen}
      onBack={handleBack}
      onRetry={load}
      onNewApplication={() => router.push("/shop-application")}
      onLoginPopupClose={() => (onBack ? onBack() : router.back())}
      loginReturnUrl={loginReturnUrl}
    />
  );
};

export default ShopApplicationsList;
