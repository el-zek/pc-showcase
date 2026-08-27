import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CrmIntelProvider } from "@/components/crm/crm-intel-provider";

export const Route = createFileRoute("/_authenticated/m/crm")({
  component: () => (
    <CrmIntelProvider>
      <Outlet />
    </CrmIntelProvider>
  ),
});
