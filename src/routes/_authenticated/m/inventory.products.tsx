import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInventory, formatMoney, stockStatus, type ProductRecord } from "@/components/inventory/inventory-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { supabase } from "@/integrations/supabase/client";

function ProductPhoto({ path }: { path?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    void supabase.storage.from("product-images").createSignedUrl(path, 60 * 60).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!path) return <span className="text-white/50">No photo — use Scan on mobile</span>;
  if (!url) return <span className="text-white/50">Loading…</span>;
  return <img src={url} alt="Product photo" className="max-h-28 rounded-xl object-contain" />;
}

export const Route = createFileRoute("/_authenticated/m/inventory/products")({ component: ProductsPage });

function ProductsPage() {
  const { products, categories, suppliers, warehouses, saveProduct, deleteProduct, metrics } = useInventory();
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<ProductRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductRecord | null>(null);

  const categoryNames = categories.map((row) => row.name);
  const supplierNames = ["—", ...suppliers.map((row) => row.name)];
  const warehouseNames = ["—", ...warehouses.map((row) => row.name)];

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: ProductRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const categoryName = str(value.category);
    const supplierName = str(value.supplier);
    const warehouseName = str(value.warehouse);
    saveProduct(
      {
        name: str(value.name),
        sku: editing?.sku ?? "",
        category: categoryName,
        categoryId: categories.find((row) => row.name === categoryName)?.id ?? "",
        supplierId: suppliers.find((row) => row.name === supplierName)?.id ?? "",
        warehouseId: warehouses.find((row) => row.name === warehouseName)?.id ?? "",
        sellingPrice: num(value.sellingPrice),
        costPrice: num(value.costPrice),
        stockQuantity: editing?.stockQuantity ?? 0,
        reorderLevel: editing?.reorderLevel ?? 5,
        active: editing?.active ?? true,
        description: str(value.description),
      },
      editing?.id,
    );
    toast.success(editing ? "Product updated" : "Product added");
  };


  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((row) => row.id === id)?.name ?? "—";

  return (
    <TaxWorkspace
      title="Products"
      subtitle="Catalogue, pricing and stock levels"
      icon={Package}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New product
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Products", value: String(metrics.totalProducts), accent: true },
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
          { key: "category", label: "Category", hideOnMobile: true, render: (row) => row.category || "—" },
          { key: "sellingPrice", label: "Price", render: (row) => formatMoney(row.sellingPrice) },
          { key: "stockQuantity", label: "Stock", render: (row) => String(row.stockQuantity) },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "products.csv",
            ["Product", "SKU", "Category", "Price", "Cost", "Stock"],
            rows.map((row) => [row.name, row.sku, row.category, row.sellingPrice, row.costPrice, row.stockQuantity]),
          )
        }
        addLabel="New product"
        onAdd={openCreate}
        empty={{ title: "No products yet", description: "Add products to start tracking stock and pricing.", icon: Package }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit product" : "New product"}
        description="Product catalogue details."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={
          editing
            ? {
                name: editing.name,
                category: editing.category || (categoryNames[0] ?? ""),
                supplier: nameOf(suppliers, editing.supplierId),
                warehouse: nameOf(warehouses, editing.warehouseId),
                sellingPrice: editing.sellingPrice,
                costPrice: editing.costPrice,
                description: editing.description,
              }
            : null
        }
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "name", label: "Product name", type: "text", required: true, half: true },
          { name: "category", label: "Category", type: "select", options: categoryNames.length ? categoryNames : ["Uncategorised"], half: true },
          { name: "supplier", label: "Supplier", type: "select", options: supplierNames, half: true },
          { name: "warehouse", label: "Warehouse", type: "select", options: warehouseNames, half: true },
          { name: "sellingPrice", label: "Selling price", type: "number", required: true, half: true },
          { name: "costPrice", label: "Cost price", type: "number", half: true },
          { name: "description", label: "Description", type: "text" },
        ]}

      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Product details"
        rows={
          detail
            ? [
                { label: "Photo", value: <ProductPhoto path={detail.imagePath} /> },
                { label: "SKU", value: detail.sku || "—" },
                { label: "Category", value: detail.category || "—" },
                { label: "Supplier", value: nameOf(suppliers, detail.supplierId) },
                { label: "Warehouse", value: nameOf(warehouses, detail.warehouseId) },
                { label: "Selling price", value: formatMoney(detail.sellingPrice) },
                { label: "Cost price", value: formatMoney(detail.costPrice) },
                { label: "Stock", value: String(detail.stockQuantity) },
                { label: "Reorder level", value: String(detail.reorderLevel) },
                { label: "Status", value: <StatusBadge value={stockStatus(detail)} /> },
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
        title="Delete product"
        description={`${pendingDelete?.name ?? ""} will be removed from your catalogue.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteProduct(pendingDelete.id); toast.success("Product deleted"); } }}
      />
    </TaxWorkspace>
  );
}
