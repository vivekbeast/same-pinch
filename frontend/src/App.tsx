import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { lazy, Suspense } from "react";
import { RouterProvider } from "react-router/dom";
import { Background } from "./app/Background";
import { router } from "./app/router";
import { persistOptions, queryClient } from "./lib/query";
import { useLang } from "./lib/i18n";

const ToasterHost = lazy(() => import("./app/ToasterHost"));

export default function App() {
  useLang(); // re-render the tree when the UI language changes
  return (
    // The player's own data is persisted, so Today, the flame and the wallet open offline (docs/ARCHITECTURE.md §4).
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <RouterProvider router={router} />
      <Background />
      <Suspense fallback={null}>
        <ToasterHost />
      </Suspense>
    </PersistQueryClientProvider>
  );
}
