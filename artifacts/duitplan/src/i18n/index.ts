import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ms from "./locales/ms.json";
import id from "./locales/id.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
    id: { translation: id },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  initImmediate: false,
});

export default i18n;
