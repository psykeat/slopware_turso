import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import de from "../locales/de.json";
import en from "../locales/en.json";

const storedLang =
  typeof window !== "undefined" &&
  typeof localStorage !== "undefined" &&
  typeof localStorage.getItem === "function"
    ? (localStorage.getItem("lang") ?? "en")
    : "en";

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
