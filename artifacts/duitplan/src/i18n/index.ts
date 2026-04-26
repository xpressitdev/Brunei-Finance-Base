import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ms from "./locales/ms.json";
import id from "./locales/id.json";

const VALID_LANGS = new Set(["en", "ms", "id"]);
const STORAGE_KEY = "i18n_language_override";

function resolveInitialLanguage(): string {
  if (typeof window === "undefined") return "en";

  // 1. Explicit localStorage override (set only by the language switcher)
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_LANGS.has(stored)) return stored;

  // 2. Hostname detection
  const hostname = window.location.hostname;
  if (hostname.startsWith("my.") || hostname === "my.duitplan.com") return "ms";
  if (hostname.startsWith("id.") || hostname === "id.duitplan.com") return "id";
  if (hostname.startsWith("bn.") || hostname === "bn.duitplan.com") return "en";

  // 3. Browser locale
  const nav = navigator.language ?? "";
  if (nav.startsWith("ms")) return "ms";
  if (nav.startsWith("id") || nav.startsWith("in")) return "id";
  if (nav.startsWith("en")) return "en";

  // 4. Final fallback
  return "en";
}

const initialLang = resolveInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
    id: { translation: id },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  initImmediate: false,
});

export { STORAGE_KEY, VALID_LANGS };
export default i18n;
