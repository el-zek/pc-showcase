import { createFileRoute } from "@tanstack/react-router";
import { TaxModuleProvider } from "@/components/tax-module-provider";
import { ExpensesPage } from "@/components/tax/expenses-page";

export const Route = createFileRoute("/_authenticated/m/finance/expenses")({ component: FinanceExpenses });

/** Exactly the same Expenses module as Tax Management — same table, logic and UI. */
function FinanceExpenses() {
  return (
    <TaxModuleProvider>
      <ExpensesPage backTo="/m/finance" backLabel="Back to Finance" />
    </TaxModuleProvider>
  );
}
