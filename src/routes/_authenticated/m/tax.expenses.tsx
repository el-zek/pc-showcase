import { createFileRoute } from "@tanstack/react-router";
import { ExpensesPage } from "@/components/tax/expenses-page";

export const Route = createFileRoute("/_authenticated/m/tax/expenses")({ component: ExpensesPage });
