import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInventory, formatMoney, stockStatus, type MovementType, type ProductRecord } from "@/components/inventory/inventory-provider";
import { RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/inventory/stock")({ component: StockPage });

function StockPage() {
  const { products, movements, metrics, adjustStock } = useInventory();
  const [target, setTarget] = useState<ProductRecord | null>(null);
  const [detail, setDetail] = useState<ProductRecord | null>(null);

  const submit = (value: Record<string, FieldValue>) => {
    if (!target) return;
    const type = str(value.type) as MovementType;
    void adjustStock({
      productId: target.id,
      type,
      quantity: num(value.quantity),
      notes: str(value.notes),
      reference: type === "Adjustment" ? "set" : undefined,
    });
    toast.success(`${type} recorded for ${target.name}`);
  };

  return (
    <TaxWorkspace
      title="Stock"
      subtitle="Stock in, stock out and adjustments"
      icon={Boxes}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
    >
      <SummaryStrip
        items={[
          { label: "Total Stock", value: String(metrics.totalStock), accent: true },
          { label: "Stock Value", value: formatMoney(metrics.stockValue) },

        ]}
      />

      <TaxTable
        rows={products}
        searchKeys={(row) => `${row.name} ${row.sku} ${row.category}`}
        filter={{
          label: "Status",
          options: [
            { value: "In Stock", label: "In Stock" },
            { value: "Low Stock", label: "Low Stock" },
            { value: "Out of Stock", label: "Out of Stock" },
          ],
          match: (row, value) => stockStatus(row) === value,
        }}
        columns={[
          { key: "name", label: "Product", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "stockQuantity", label: "Available Stock", render: (row) => String(row.stockQuantity) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={stockStatus(row)} /> },
        ]}
        onRowClick={setDetail}
        onEdit={setTarget}
        onExport={(rows) => exportCsv("stock.csv", ["Product", "Available Stock", "Reorder level", "Status"], rows.map((row) => [row.name, row.stockQuantity, row.reorderLevel, stockStatus(row)]))}
        empty={{ title: "No stock records", description: "Add products first to manage stock levels.", icon: Boxes }}
      />

      <RecordDialog
        open={Boolean(target)}
        title={`Stock movement — ${target?.name ?? ""}`}
        description={`Current stock: ${target?.stockQuantity ?? 0}. Adjustment sets the stock to the entered value.`}
        submitLabel="Save movement"
        initialValue={null}
        onClose={() => setTarget(null)}
        onSubmit={submit}
        fields={[
          { name: "type", label: "Movement type", type: "select", options: ["Stock In", "Stock Out", "Adjustment"], half: true },
          { name: "quantity", label: "Quantity", type: "number", required: true, half: true },
          { name: "notes", label: "Notes", type: "text" },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Stock details"
        rows={
          detail
            ? [
                { label: "SKU", value: detail.sku || "—" },
                { label: "Category", value: detail.category || "—" },
                { label: "Available stock", value: String(detail.stockQuantity) },
                { label: "Reorder level", value: String(detail.reorderLevel) },
                { label: "Stock value", value: formatMoney(detail.stockQuantity * detail.costPrice) },
                { label: "Status", value: <StatusBadge value={stockStatus(detail)} /> },
                { label: "Movements", value: String(movements.filter((row) => row.productId === detail.id).length) },
              ]
            : []
        }
        footer={
          detail ? (
            <Button className="bg-amber-400 text-black hover:bg-amber-300" onClick={() => { setTarget(detail); setDetail(null); }}>
              <ArrowLeftRight className="mr-1.5 h-4 w-4" /> New movement
            </Button>
          ) : null
        }
      />
    </TaxWorkspace>
  );
}
