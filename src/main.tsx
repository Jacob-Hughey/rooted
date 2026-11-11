import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/auth/AuthProvider";
import { registerServiceWorker } from "@/lib/pwa";
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

// Follow the system light/dark setting
const dark = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => document.documentElement.classList.toggle("dark", dark.matches);
applyTheme();
dark.addEventListener("change", applyTheme);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
