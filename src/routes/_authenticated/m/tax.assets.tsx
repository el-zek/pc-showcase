import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTaxModule, formatCurrency, type AssetRecord } from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/assets")({ component: AssetsPage });

function AssetsPage() {
  const { assets, saveAsset, deleteAsset } = useTaxModule();
  const [editing, setEditing] = useState<AssetRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<AssetRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AssetRecord | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: AssetRecord) => { setEditing(row); setFormOpen(true); };

  const purchaseValue = assets.reduce((sum, row) => sum + row.purchaseValue, 0);
  const bookValue = assets.reduce((sum, row) => sum + row.currentValue, 0);
  const depreciation = assets.reduce((sum, row) => sum + row.depreciation, 0);

  const submit = (value: Record<string, FieldValue>) => {
    saveAsset(
      {
        name: str(value.name),
        category: str(value.category),
        purchaseDate: str(value.purchaseDate),
        purchaseValue: num(value.purchaseValue),
        currentValue: num(value.currentValue),
        depreciation: num(value.depreciation),
        usefulLife: num(value.usefulLife),
        status: str(value.status) as AssetRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Asset updated" : "Asset created");
  };

  return (
    <TaxWorkspace
      title="Capital Assets"
      subtitle="Depreciation, capital allowance and tax benefit"
      icon={Building2}
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New asset
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Purchase Value", value: formatCurrency(purchaseValue), hint: `${assets.length} assets`, accent: true },
          { label: "Book Value", value: formatCurrency(bookValue), hint: "Current net value" },
          { label: "Depreciation", value: formatCurrency(depreciation), hint: "Capital allowance" },
          { label: "Tax Benefit", value: formatCurrency(depreciation * 0.3), hint: "At 30% tax rate" },
        ]}
      />

      <TaxTable
        rows={assets}
        searchKeys={(row) => `${row.name} ${row.category} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "Active", label: "Active" },
            { value: "Disposed", label: "Disposed" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "name", label: "Asset", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "category", label: "Category", hideOnMobile: true },
          { key: "purchaseValue", label: "Purchase", render: (row) => formatCurrency(row.purchaseValue) },
          { key: "depreciation", label: "Depreciation", render: (row) => formatCurrency(row.depreciation), hideOnMobile: true },
          { key: "currentValue", label: "Book value", render: (row) => formatCurrency(row.currentValue) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "capital-assets.csv",
            ["Asset", "Category", "Purchase date", "Purchase value", "Depreciation", "Book value", "Useful life", "Status"],
            rows.map((row) => [row.name, row.category, row.purchaseDate, row.purchaseValue, row.depreciation, row.currentValue, row.usefulLife, row.status]),
          )
        }
        addLabel="New asset"
        onAdd={openCreate}
        empty={{ title: "No assets registered", description: "Add capital assets to track depreciation and allowances.", icon: Building2 }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit asset" : "New asset"}
        description="Register the asset and its depreciation position."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "name", label: "Asset name", type: "text", required: true, half: true },
          { name: "category", label: "Category", type: "select", options: ["Vehicles", "Machinery", "Equipment", "Furniture", "Buildings", "IT"], half: true },
          { name: "purchaseDate", label: "Purchase date", type: "date", required: true, half: true },
          { name: "purchaseValue", label: "Purchase value", type: "number", required: true, half: true },
          { name: "currentValue", label: "Current value", type: "number", required: true, half: true },
          { name: "depreciation", label: "Accumulated depreciation", type: "number", required: true, half: true },
          { name: "usefulLife", label: "Useful life (years)", type: "number", defaultValue: 5, half: true },
          { name: "status", label: "Status", type: "select", options: ["Active", "Disposed"], half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Capital asset details"
        rows={
          detail
            ? [
                { label: "Category", value: detail.category },
                { label: "Purchase date", value: detail.purchaseDate },
                { label: "Purchase value", value: formatCurrency(detail.purchaseValue) },
                { label: "Depreciation", value: formatCurrency(detail.depreciation) },
                { label: "Book value", value: formatCurrency(detail.currentValue) },
                { label: "Tax benefit", value: formatCurrency(detail.depreciation * 0.3) },
                { label: "Useful life", value: `${detail.usefulLife} years` },
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
        title="Delete asset"
        description={`${pendingDelete?.name ?? ""} will be removed from the asset register.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteAsset(pendingDelete.id); toast.success("Asset deleted"); } }}
      />
    </TaxWorkspace>
  );
}
