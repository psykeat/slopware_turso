import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import de from "../locales/de.json";

const storedLang = typeof localStorage !== "undefined" ? (localStorage.getItem("lang") ?? "en") : "en";

i18next.use(initReactI18next).init({
  lng: storedLang,
  fallbackLng: "en",
  resources: {
    en: { ui: en },
    de: { ui: de },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18next;
