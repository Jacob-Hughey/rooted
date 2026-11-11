/**
 * Light / dark appearance. "system" follows the device setting.
 * The choice is saved on this device only (localStorage), like most apps' appearance settings.
 * index.html applies it before the first paint so there's no flash; keep the key and colors in sync with it.
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "rooted-theme";
const COLORS = { light: "#e2ede2", dark: "#13241d" } as const;
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice = getTheme()) {
  const dark = choice === "dark" || (choice === "system" && media.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light"; // form controls, scrollbars
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? COLORS.dark : COLORS.light);
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Private browsing can block storage; the choice still applies until the app is closed
  }
  applyTheme(choice);
}

/** Apply now and keep following the device while the choice is "system". */
export function initTheme() {
  applyTheme();
  media.addEventListener("change", () => applyTheme());
}
