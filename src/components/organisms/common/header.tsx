"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import HeaderView from "./header.view";

interface HeaderProps {
  onWishlistClick?: () => void;
}

const Header = ({ onWishlistClick }: HeaderProps) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("role, avatar_url")
        .eq("id", session.user.id)
        .single();
      if (data?.role === "admin") setIsAdmin(true);
      setAvatarUrl(
        data?.avatar_url ?? session.user.user_metadata?.avatar_url ?? null,
      );
    });
  }, []);

  return (
    <HeaderView
      isAdmin={isAdmin}
      avatarUrl={avatarUrl}
      onWishlistClick={onWishlistClick}
    />
  );
};

export default Header;
