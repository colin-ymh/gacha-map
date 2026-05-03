import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// /search 직접 접근 시 defaultLocale/search로 리다이렉트
export default function SearchRedirectPage() {
  redirect(`/${routing.defaultLocale}/search`);
}
