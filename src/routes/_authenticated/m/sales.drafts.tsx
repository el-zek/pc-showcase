import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/tax/record-dialog";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { formatMoney, useSales, type SaleRecord } from "@/components/sales/sales-provider";

export const Route = createFileRoute("/_authenticated/m/sales/drafts")({ component: DraftsPage });

function DraftsPage() {
  const { sales, saleItems, completeDraft, deleteSale, metrics } = useSales();
  const [pendingDelete, setPendingDelete] = useState<SaleRecord | null>(null);
  const rows = sales.filter((row) => row.status === "Draft");

  return (
    <TaxWorkspace title="Draft Orders" subtitle="Unfinished sales — stock is not affected yet" icon={FileText} backTo="/m/sales" backLabel="Back to Sales">
      <SummaryStrip items={[{ label: "Drafts", value: String(metrics.draftCount), hint: "Pending completion", accent: true }]} />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.invoiceNumber} ${row.customerName} ${row.saleDate}`}
        columns={[
          { key: "invoiceNumber", label: "Draft", render: (row) => <span className="font-medium text-white">{row.invoiceNumber}</span> },
          { key: "customerName", label: "Customer" },
          { key: "saleDate", label: "Date", hideOnMobile: true },
          { key: "items", label: "Items", render: (row) => String(saleItems.filter((item) => item.saleId === row.id).length), hideOnMobile: true },
          { key: "total", label: "Total", render: (row) => formatMoney(row.total) },
        ]}
        rowActions={(row) => [
          { label: "Complete sale", onSelect: () => void completeDraft(row.id).then(() => toast.success("Sale completed — stock updated")) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(list) => exportCsv("draft-orders.csv", ["Draft", "Customer", "Date", "Total"], list.map((row) => [row.invoiceNumber, row.customerName, row.saleDate, row.total]))}
        empty={{ title: "No drafts", description: "Save a sale as draft to park it here.", icon: FileText }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete draft"
        description={`${pendingDelete?.invoiceNumber ?? ""} will be removed.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deleteSale(pendingDelete.id).then(() => toast.success("Draft deleted")); }}
      />
    </TaxWorkspace>
  );
}
