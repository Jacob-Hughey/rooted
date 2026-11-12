import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/auth/AuthProvider";
import { persistQueryCache, restoreQueryCache } from "@/data/persist";
import { startOutbox } from "@/data/outbox";
import { registerServiceWorker } from "@/lib/pwa";
import { initTheme } from "@/lib/theme";
import App from "./App";
// Alegreya Sans ships with the app (Latin + accented Latin only) so it works offline
import "@fontsource/alegreya-sans/latin-400.css";
import "@fontsource/alegreya-sans/latin-400-italic.css";
import "@fontsource/alegreya-sans/latin-500.css";
import "@fontsource/alegreya-sans/latin-700.css";
import "@fontsource/alegreya-sans/latin-ext-400.css";
import "@fontsource/alegreya-sans/latin-ext-400-italic.css";
import "@fontsource/alegreya-sans/latin-ext-500.css";
import "@fontsource/alegreya-sans/latin-ext-700.css";
import "./index.css";

// Light / dark: the choice from Settings, or the device setting
initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep data for screens she isn't looking at, so they open offline too (it's saved on the device).
      gcTime: 7 * 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

registerServiceWorker();
startOutbox(queryClient);

// Open with the plants saved on the device (a few ms), then refresh from the server.
restoreQueryCache(queryClient).finally(() => {
  persistQueryCache(queryClient);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
