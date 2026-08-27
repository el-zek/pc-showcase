import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Truck, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInventory, type TransferRecord } from "@/components/inventory/inventory-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/inventory/transfers")({ component: TransfersPage });

function TransfersPage() {
  const { transfers, products, warehouses, saveTransfer, deleteTransfer, completeTransfer } = useInventory();
  const [editing, setEditing] = useState<TransferRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<TransferRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransferRecord | null>(null);

  const productNames = products.map((row) => row.name);
  const warehouseNames = warehouses.map((row) => row.name);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: TransferRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const productName = str(value.productName);
    saveTransfer(
      {
        productId: products.find((row) => row.name === productName)?.id ?? "",
        productName,
        fromWarehouse: str(value.fromWarehouse),
        toWarehouse: str(value.toWarehouse),
        quantity: num(value.quantity),
        notes: str(value.notes),
        transferDate: str(value.transferDate),
        status: str(value.status) as TransferRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Transfer updated" : "Transfer created");
  };

  return (
    <TaxWorkspace
      title="Transfers"
      subtitle="Move stock between warehouses"
      icon={Truck}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New transfer
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Transfers", value: String(transfers.length), accent: true },
          { label: "Pending", value: String(transfers.filter((row) => row.status === "Pending").length), tone: "warning" },
          { label: "Completed", value: String(transfers.filter((row) => row.status === "Completed").length), tone: "success" },
        ]}
      />

      <TaxTable
        rows={transfers}
        searchKeys={(row) => `${row.productName} ${row.fromWarehouse} ${row.toWarehouse} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "Pending", label: "Pending" },
            { value: "Completed", label: "Completed" },
            { value: "Cancelled", label: "Cancelled" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "productName", label: "Product", render: (row) => <span className="font-medium text-white">{row.productName || "—"}</span> },
          { key: "fromWarehouse", label: "From", render: (row) => row.fromWarehouse || "—" },
          { key: "toWarehouse", label: "To", render: (row) => row.toWarehouse || "—" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) => exportCsv("transfers.csv", ["Product", "From", "To", "Quantity", "Date", "Status"], rows.map((row) => [row.productName, row.fromWarehouse, row.toWarehouse, row.quantity, row.transferDate, row.status]))}
        addLabel="New transfer"
        onAdd={openCreate}
        empty={{ title: "No transfers yet", description: "Create a transfer to move stock between warehouses.", icon: Truck }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit transfer" : "New transfer"}
        description="Stock movement between locations."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : { transferDate: new Date().toISOString().slice(0, 10) }}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "productName", label: "Product", type: "select", options: productNames.length ? productNames : ["—"], half: true },
          { name: "quantity", label: "Quantity", type: "number", required: true, half: true },
          { name: "fromWarehouse", label: "From warehouse", type: "select", options: warehouseNames.length ? warehouseNames : ["—"], half: true },
          { name: "toWarehouse", label: "To warehouse", type: "select", options: warehouseNames.length ? warehouseNames : ["—"], half: true },
          { name: "transferDate", label: "Transfer date", type: "date", required: true, half: true },
          { name: "status", label: "Status", type: "select", options: ["Pending", "Completed", "Cancelled"], half: true },
          { name: "notes", label: "Notes", type: "text" },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.productName || "Transfer"}
        description="Transfer details"
        rows={
          detail
            ? [
                { label: "From", value: detail.fromWarehouse || "—" },
                { label: "To", value: detail.toWarehouse || "—" },
                { label: "Quantity", value: String(detail.quantity) },
                { label: "Transfer date", value: detail.transferDate },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
                { label: "Notes", value: detail.notes || "—" },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              {detail.status === "Pending" ? (
                <Button
                  className="bg-emerald-500 text-white hover:bg-emerald-400"
                  onClick={() => { void completeTransfer(detail.id); setDetail(null); toast.success("Transfer completed"); }}
                >
                  <Check className="mr-1.5 h-4 w-4" /> Complete
                </Button>
              ) : null}
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => { openEdit(detail); setDetail(null); }}>Edit</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete transfer"
        description={`${pendingDelete?.productName ?? ""} transfer will be removed.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteTransfer(pendingDelete.id); toast.success("Transfer deleted"); } }}
      />
    </TaxWorkspace>
  );
}
