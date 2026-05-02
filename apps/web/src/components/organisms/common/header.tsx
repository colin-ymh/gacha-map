"use client";

import { useAppSelector } from "@/store/hooks";
import { selectIsAdmin, selectAvatarUrl } from "@/store/slices/auth.slice";
import HeaderView from "./header.view";

interface HeaderProps {
  onWishlistClick?: () => void;
  onMypageClick?: () => void;
  onReportClick?: () => void;
}

const Header = ({
  onWishlistClick,
  onMypageClick,
  onReportClick,
}: HeaderProps) => {
  const isAdmin = useAppSelector(selectIsAdmin);
  const avatarUrl = useAppSelector(selectAvatarUrl);

  return (
    <HeaderView
      isAdmin={isAdmin ?? false}
      avatarUrl={avatarUrl}
      onWishlistClick={onWishlistClick}
      onMypageClick={onMypageClick}
      onReportClick={onReportClick}
    />
  );
};

export default Header;
