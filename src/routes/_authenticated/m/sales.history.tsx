import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { formatMoney, useSales } from "@/components/sales/sales-provider";

export const Route = createFileRoute("/_authenticated/m/sales/history")({ component: HistoryPage });

function HistoryPage() {
  const { sales, saleItems, metrics } = useSales();
  const rows = sales.filter((row) => row.status === "Completed");
  const itemCount = (id: string) => saleItems.filter((item) => item.saleId === id).length;

  return (
    <TaxWorkspace title="Sales History" subtitle="Every completed sale, newest first" icon={History} backTo="/m/sales" backLabel="Back to Sales">
      <SummaryStrip
        items={[
          { label: "Total sales", value: formatMoney(metrics.salesTotal), hint: `${metrics.salesCount} sales`, accent: true },
          { label: "Tax collected", value: formatMoney(metrics.taxTotal) },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.invoiceNumber} ${row.customerName} ${row.saleDate} ${row.paymentMethod}`}
        columns={[
          { key: "invoiceNumber", label: "Invoice", render: (row) => <span className="font-medium text-white">{row.invoiceNumber}</span> },
          { key: "customerName", label: "Customer" },
          { key: "saleDate", label: "Date", hideOnMobile: true },
          { key: "items", label: "Items", render: (row) => String(itemCount(row.id)), hideOnMobile: true },
          { key: "total", label: "Total", render: (row) => formatMoney(row.total) },
        ]}
        onExport={(list) => exportCsv("sales-history.csv", ["Invoice", "Customer", "Date", "Method", "Total"], list.map((row) => [row.invoiceNumber, row.customerName, row.saleDate, row.paymentMethod, row.total]))}
        empty={{ title: "No sales yet", description: "Completed sales will appear here.", icon: History }}
      />
    </TaxWorkspace>
  );
}
