import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Warehouse, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInventory, type WarehouseRecord } from "@/components/inventory/inventory-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/inventory/warehouses")({ component: WarehousesPage });

function WarehousesPage() {
  const { warehouses, products, saveWarehouse, deleteWarehouse } = useInventory();
  const [editing, setEditing] = useState<WarehouseRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<WarehouseRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WarehouseRecord | null>(null);

  const countFor = (row: WarehouseRecord) => products.filter((product) => product.warehouseId === row.id).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: WarehouseRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    saveWarehouse(
      {
        name: str(value.name),
        location: str(value.location),
        manager: str(value.manager),
        capacity: num(value.capacity),
        status: str(value.status) as WarehouseRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Warehouse updated" : "Warehouse added");
  };

  return (
    <TaxWorkspace
      title="Warehouses"
      subtitle="Storage locations for your stock"
      icon={Warehouse}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New warehouse
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Warehouses", value: String(warehouses.length), accent: true },
          { label: "Active", value: String(warehouses.filter((row) => row.status === "Active").length) },
        ]}
      />

      <TaxTable
        rows={warehouses}
        searchKeys={(row) => `${row.name} ${row.location} ${row.manager}`}
        filter={{
          label: "Status",
          options: [
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "name", label: "Warehouse", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "location", label: "Location", render: (row) => row.location || "—" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) => exportCsv("warehouses.csv", ["Warehouse", "Location", "Manager", "Capacity", "Status"], rows.map((row) => [row.name, row.location, row.manager, row.capacity, row.status]))}
        addLabel="New warehouse"
        onAdd={openCreate}
        empty={{ title: "No warehouses yet", description: "Add storage locations to organise stock and transfers.", icon: Warehouse }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit warehouse" : "New warehouse"}
        description="Storage location details."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "name", label: "Warehouse name", type: "text", required: true, half: true },
          { name: "location", label: "Location", type: "text", half: true },
          { name: "manager", label: "Manager", type: "text", half: true },
          { name: "capacity", label: "Capacity", type: "number", half: true },
          { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Warehouse details"
        rows={
          detail
            ? [
                { label: "Location", value: detail.location || "—" },
                { label: "Manager", value: detail.manager || "—" },
                { label: "Capacity", value: detail.capacity ? String(detail.capacity) : "—" },
                { label: "Products", value: String(countFor(detail)) },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => { openEdit(detail); setDetail(null); }}>Edit</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete warehouse"
        description={`${pendingDelete?.name ?? ""} will be removed from your locations.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteWarehouse(pendingDelete.id); toast.success("Warehouse deleted"); } }}
      />
    </TaxWorkspace>
  );
}
