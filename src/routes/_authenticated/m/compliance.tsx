import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TaxModuleProvider } from "@/components/tax-module-provider";
import { ComplianceProvider } from "@/components/compliance/compliance-provider";

export const Route = createFileRoute("/_authenticated/m/compliance")({ component: ComplianceLayout });

function ComplianceLayout() {
  return (
    <TaxModuleProvider>
      <ComplianceProvider>
        <Outlet />
      </ComplianceProvider>
    </TaxModuleProvider>
  );
}
