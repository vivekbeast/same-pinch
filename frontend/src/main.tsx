import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import App from "./App";
import { setLang } from "./lib/i18n";
import { savedLang } from "./lib/session";

const root = document.getElementById("root")!;

// Load the saved UI language before first render so non-English players never see an English flash.
const lang = savedLang();
(lang === "en" ? Promise.resolve() : setLang(lang).catch(() => undefined)).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
