import React from "react";
import { createRoot } from "react-dom/client";
import { DailyHadith } from "../../src/components/game/DailyHadith";
import { FixtureLanguage } from "./mock-sources";

createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-3xl px-4 py-6"><FixtureLanguage><DailyHadith /></FixtureLanguage></main>,
);
