import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/route-pending";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        placeholderData: (prev: unknown) => prev,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    scrollToTopSelectors: ["#app-scroll"],
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 0,
    // Show a skeleton almost immediately instead of freezing on the old page,
    // so navigation always feels like it moved.
    defaultPendingMs: 120,
    defaultPendingMinMs: 220,
    defaultPendingComponent: RoutePending,
  });

  return router;
};

