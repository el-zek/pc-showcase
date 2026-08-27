import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useInventory, type MovementRecord } from "@/components/inventory/inventory-provider";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/inventory/movements")({ component: MovementsPage });

function MovementsPage() {
  const { movements } = useInventory();
  const [detail, setDetail] = useState<MovementRecord | null>(null);

  const count = (type: string) => movements.filter((row) => row.type === type).length;

  return (
    <TaxWorkspace
      title="Stock Movement"
      subtitle="Read-only history of every stock change"
      icon={ArrowLeftRight}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
    >
      <SummaryStrip
        items={[
          { label: "Movements", value: String(movements.length), accent: true },
          { label: "Stock In", value: String(count("Stock In")) },
          { label: "Stock Out", value: String(count("Stock Out")) },
          { label: "Purchases", value: String(count("Purchase")) },
        ]}
      />

      <TaxTable
        rows={movements}
        searchKeys={(row) => `${row.productName} ${row.type} ${row.reference} ${row.movementDate}`}
        filter={{
          label: "Type",
          options: [
            { value: "Stock In", label: "Stock In" },
            { value: "Stock Out", label: "Stock Out" },
            { value: "Purchase", label: "Purchase" },
            { value: "Adjustment", label: "Adjustment" },
            { value: "Transfer", label: "Transfer" },
          ],
          match: (row, value) => row.type === value,
        }}
        columns={[
          { key: "movementDate", label: "Date" },
          { key: "productName", label: "Product", render: (row) => <span className="font-medium text-white">{row.productName || "—"}</span> },
          { key: "type", label: "Type", render: (row) => <StatusBadge value={row.type} /> },
          { key: "quantity", label: "Quantity", render: (row) => (row.quantity > 0 ? `+${row.quantity}` : String(row.quantity)) },
        ]}
        onRowClick={setDetail}
        onExport={(rows) => exportCsv("stock-movements.csv", ["Date", "Product", "Type", "Quantity", "Reference"], rows.map((row) => [row.movementDate, row.productName, row.type, row.quantity, row.reference]))}
        empty={{ title: "No stock movements", description: "Movements appear automatically as you record stock, purchases and transfers.", icon: ArrowLeftRight }}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.productName || "Movement"}
        description="Movement details"
        rows={
          detail
            ? [
                { label: "Date", value: detail.movementDate },
                { label: "Type", value: <StatusBadge value={detail.type} /> },
                { label: "Quantity", value: detail.quantity > 0 ? `+${detail.quantity}` : String(detail.quantity) },
                { label: "Reference", value: detail.reference || "—" },
                { label: "Notes", value: detail.notes || "—" },
              ]
            : []
        }
      />
    </TaxWorkspace>
  );
}
