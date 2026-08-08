"use client";

import { useAppSelector } from "@/store/hooks";
import { selectIsAdmin } from "@/store/slices/auth.slice";
import HeaderView from "./header.view";

const Header = () => {
  const isAdmin = useAppSelector(selectIsAdmin);

  return <HeaderView isAdmin={isAdmin ?? false} />;
};

export default Header;
