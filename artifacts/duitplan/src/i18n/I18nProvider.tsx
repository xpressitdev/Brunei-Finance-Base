import { useEffect } from "react";
import { useGetProfile } from "@workspace/api-client-react";
import i18n, { STORAGE_KEY } from "./index";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useGetProfile();

  useEffect(() => {
    if (profile?.language) {
      // Authenticated user: profile language always wins, clear any visitor override
      localStorage.removeItem(STORAGE_KEY);
      if (i18n.language !== profile.language) {
        i18n.changeLanguage(profile.language);
      }
    }
    // Unauthenticated: language was resolved at init time by resolveInitialLanguage()
    // — don't override it here so the switcher choice is preserved
  }, [profile?.language]);

  return <>{children}</>;
}
