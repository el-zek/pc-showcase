import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { initNative } from "../lib/native";
import { AdminPage, type Section } from "@/components/admin/admin-workspace";

function NotFoundComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const previewSection = getAdminPreviewSection(pathname);

  if (import.meta.env.DEV && previewSection) {
    return <AdminPage section={previewSection} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md btn-gradient px-4 py-2 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function getAdminPreviewSection(pathname: string): Section | null {
  const match = pathname.match(
    /^\/_authenticated\/m\/admin\/(users|roles|permissions|settings|activity-logs|security)\/?$/,
  );
  if (!match) return null;
  return match[1] === "activity-logs" ? "activity" : (match[1] as Section);
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md btn-gradient px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "BIZZ AUTOMATORS | Business Management Platform" },
      {
        name: "description",
        content:
          "BIZZ AUTOMATORS provides a modular business management platform for retail, inventory, point of sale, finance, and operations.",
      },
      {
        name: "keywords",
        content:
          "business management software, POS system, inventory management, accounting, invoicing, retail operations, BIZZ AUTOMATORS",
      },
      {
        name: "robots",
        content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
      },
      { name: "author", content: "BIZZ AUTOMATORS" },
      { name: "application-name", content: "BIZZ AUTOMATORS" },
      { name: "apple-mobile-web-app-title", content: "BIZZ AUTOMATORS" },
      { name: "generator", content: "Vite + TanStack Start" },
      { name: "category", content: "Business Management" },
      { name: "theme-color", content: "#09090b" },
      { name: "color-scheme", content: "dark light" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "format-detection", content: "telephone=no" },
      { name: "msapplication-TileColor", content: "#09090b" },
      { property: "og:title", content: "BIZZ AUTOMATORS | Business Management Platform" },
      {
        property: "og:description",
        content:
          "BIZZ AUTOMATORS brings POS, inventory, finance, and reporting together in one modern business management platform.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.bizzautomators.com/" },
      { property: "og:site_name", content: "BIZZ AUTOMATORS" },
      { property: "og:image", content: "https://www.bizzautomators.com/favicon-96x96.png" },
      { property: "og:image:width", content: "96" },
      { property: "og:image:height", content: "96" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BIZZ AUTOMATORS | Business Management Platform" },
      {
        name: "twitter:description",
        content: "Modern business management for retail, inventory, POS, finance, and reporting.",
      },
      { name: "twitter:image", content: "https://www.bizzautomators.com/favicon-96x96.png" },
      { name: "twitter:creator", content: "BIZZ AUTOMATORS" },
      { name: "twitter:site", content: "BIZZ AUTOMATORS" },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "BIZZ AUTOMATORS",
          url: "https://www.bizzautomators.com/",
          logo: "https://www.bizzautomators.com/favicon.svg",
          description:
            "BIZZ AUTOMATORS provides a modular platform for retail, inventory, POS, finance, and operations management.",
          sameAs: [],
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "Customer Support",
            areaServed: "Global",
          },
        },
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=2" },
      { rel: "icon", type: "image/png", href: "/favicon-96x96.png?v=2", sizes: "96x96" },
      { rel: "shortcut icon", href: "/favicon.ico?v=2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=2" },
      { rel: "canonical", href: "https://www.bizzautomators.com/" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Native (Capacitor) behaviour: status bar, splash, back button, deep links.
  // No-op in the browser.
  useEffect(() => {
    void initNative({
      canGoBack: () => window.history.length > 1 && router.state.location.pathname !== "/",
      goBack: () => router.history.back(),
    });
  }, [router]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-right" richColors />
    </QueryClientProvider>
  );
}
