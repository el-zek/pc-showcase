// Native (Capacitor) runtime behaviour. No-ops on the web — the browser
// experience is untouched.

let initialized = false;

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function isNativeApp(): boolean {
  return isNative();
}

/** Opens http(s) links that leave the app in the system browser. */
async function openExternal(url: string) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

export async function initNative(handlers: {
  canGoBack: () => boolean;
  goBack: () => void;
}) {
  if (initialized || !isNative()) return;
  initialized = true;

  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Keyboard }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/keyboard"),
  ]);

  // Status bar matches the app's dark chrome.
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    /* iOS ignores background colour; safe to skip */
  }

  // Hide the splash once the app shell is interactive.
  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    /* no splash in some contexts */
  }

  // Keyboard: add a class so fixed bottom nav can stay out of the way.
  try {
    Keyboard.addListener("keyboardWillShow", () =>
      document.documentElement.classList.add("keyboard-open"),
    );
    Keyboard.addListener("keyboardWillHide", () =>
      document.documentElement.classList.remove("keyboard-open"),
    );
  } catch {
    /* keyboard plugin unavailable */
  }

  // Android hardware back button: navigate back, else exit at the root.
  App.addListener("backButton", () => {
    const openOverlay = document.querySelector<HTMLElement>(
      "[data-state='open'][role='dialog'], [data-state='open'][role='alertdialog']",
    );
    if (openOverlay) {
      openOverlay.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }
    if (handlers.canGoBack()) {
      handlers.goBack();
      return;
    }
    App.exitApp();
  });

  // Deep links: bizzautomators.com/... → in-app route.
  App.addListener("appUrlOpen", ({ url }) => {
    try {
      const parsed = new URL(url);
      window.location.assign(parsed.pathname + parsed.search + parsed.hash);
    } catch {
      /* ignore malformed deep link */
    }
  });

  // External links open in the system browser instead of hijacking the webview.
  document.addEventListener("click", (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || !/^https?:\/\//i.test(href)) return;
    if (anchor.getAttribute("target") === "_self") return;
    if (new URL(href).host === window.location.host) return;
    event.preventDefault();
    void openExternal(href);
  });
}
