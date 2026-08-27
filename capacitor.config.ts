import type { CapacitorConfig } from "@capacitor/cli";

// The web app is server-rendered (TanStack Start on the edge), so the native
// shells load the same deployed app over HTTPS instead of bundling a static
// copy. ONE codebase, ONE backend, ONE database.
// Production default; override per build with CAP_SERVER_URL.
const SERVER_URL = process.env["CAP_SERVER_URL"] ?? "https://buzz-gallery-hub.lovable.app";

const config: CapacitorConfig = {
  appId: "com.bizzautomators.app",
  appName: "Bizz Automators",
  webDir: "mobile-shell",
  bundledWebRuntime: false,
  server: {
    url: SERVER_URL,
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
    // Anything outside these hosts opens in the system browser.
    allowNavigation: [
      "buzz-gallery-hub.lovable.app",
      "project--c1583629-42a8-41d7-81b9-87fbacf94a59.lovable.app",
      "*.bizzautomators.com",
      "bizzautomators.com",
      "yodhzjdbzbryfggiqwrp.supabase.co",
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#09090b",
  },
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#09090b",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: "#09090bff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
