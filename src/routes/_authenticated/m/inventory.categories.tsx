import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tags, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInventory, type CategoryRecord } from "@/components/inventory/inventory-provider";
import { RecordDialog, ConfirmDialog, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/inventory/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const { categories, products, saveCategory, deleteCategory } = useInventory();
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<CategoryRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryRecord | null>(null);

  const countFor = (row: CategoryRecord) =>
    products.filter((product) => product.categoryId === row.id || product.category === row.name).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: CategoryRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    saveCategory({ name: str(value.name), description: str(value.description) }, editing?.id);
    toast.success(editing ? "Category updated" : "Category added");
  };

  return (
    <TaxWorkspace
      title="Categories"
      subtitle="Group products for easier reporting"
      icon={Tags}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New category
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Categories", value: String(categories.length), accent: true },
          { label: "Products", value: String(products.length) },
        ]}
      />

      <TaxTable
        rows={categories}
        searchKeys={(row) => `${row.name} ${row.description}`}
        columns={[
          { key: "name", label: "Category", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "count", label: "Products", render: (row) => String(countFor(row)) },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) => exportCsv("categories.csv", ["Category", "Products", "Description"], rows.map((row) => [row.name, countFor(row), row.description]))}
        addLabel="New category"
        onAdd={openCreate}
        empty={{ title: "No categories yet", description: "Create categories to organise your products.", icon: Tags }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit category" : "New category"}
        description="Product grouping."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { name: editing.name, description: editing.description } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "name", label: "Category name", type: "text", required: true, half: true },
          { name: "description", label: "Description", type: "text", half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Category details"
        rows={
          detail
            ? [
                { label: "Products", value: String(countFor(detail)) },
                { label: "Description", value: detail.description || "—" },
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
        title="Delete category"
        description={`${pendingDelete?.name ?? ""} will be removed. Products keep their existing labels.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteCategory(pendingDelete.id); toast.success("Category deleted"); } }}
      />
    </TaxWorkspace>
  );
}
