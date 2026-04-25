import { useEffect } from "react";
import { useGetProfile } from "@workspace/api-client-react";
import i18n from "./index";

function detectBrowserLang(): string {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") ?? "en";
  if (nav.startsWith("id")) return "id";
  if (nav.startsWith("ms")) return "ms";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useGetProfile();

  useEffect(() => {
    const lang = profile?.language ?? detectBrowserLang();
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [profile?.language]);

  return <>{children}</>;
}
