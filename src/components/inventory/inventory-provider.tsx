import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/* --------------------------------- types --------------------------------- */

export type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  category: string;
  categoryId: string;
  supplierId: string;
  warehouseId: string;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  active: boolean;
  description: string;
  imagePath?: string;
};

export type CategoryRecord = {
  id: string;
  name: string;
  description: string;
};

export type SupplierRecord = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  status: "Active" | "Inactive";
};

export type WarehouseRecord = {
  id: string;
  name: string;
  location: string;
  manager: string;
  capacity: number;
  status: "Active" | "Inactive";
};

export type PurchaseItemRecord = {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
};

export type InventoryPurchaseRecord = {
  id: string;
  purchaseNo: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  purchaseDate: string;
  total: number;
  notes: string;
  status: "Pending" | "Received" | "Cancelled";
};

export type TransferRecord = {
  id: string;
  productId: string;
  productName: string;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: number;
  notes: string;
  transferDate: string;
  status: "Pending" | "Completed" | "Cancelled";
};

export type MovementType = "Stock In" | "Stock Out" | "Purchase" | "Adjustment" | "Transfer";

export type MovementRecord = {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  reference: string;
  notes: string;
  movementDate: string;
};

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export function stockStatus(product: ProductRecord): StockStatus {
  if (product.stockQuantity <= 0) return "Out of Stock";
  if (product.stockQuantity <= product.reorderLevel) return "Low Stock";
  return "In Stock";
}

type InventoryMetrics = {
  totalProducts: number;
  totalStock: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
};

type ContextValue = {
  loading: boolean;
  products: ProductRecord[];
  categories: CategoryRecord[];
  suppliers: SupplierRecord[];
  warehouses: WarehouseRecord[];
  purchases: InventoryPurchaseRecord[];
  purchaseItems: PurchaseItemRecord[];
  transfers: TransferRecord[];
  movements: MovementRecord[];
  metrics: InventoryMetrics;
  refresh: () => Promise<void>;
  saveProduct: (record: Omit<ProductRecord, "id">, id?: string) => void;
  deleteProduct: (id: string) => void;
  saveCategory: (record: Omit<CategoryRecord, "id">, id?: string) => void;
  deleteCategory: (id: string) => void;
  saveSupplier: (record: Omit<SupplierRecord, "id">, id?: string) => void;
  deleteSupplier: (id: string) => void;
  saveWarehouse: (record: Omit<WarehouseRecord, "id">, id?: string) => void;
  deleteWarehouse: (id: string) => void;
  savePurchase: (
    record: Omit<InventoryPurchaseRecord, "id">,
    items: Omit<PurchaseItemRecord, "id" | "purchaseId">[],
    id?: string,
  ) => Promise<void>;
  deletePurchase: (id: string) => void;
  receivePurchase: (id: string) => Promise<void>;
  saveTransfer: (record: Omit<TransferRecord, "id">, id?: string) => void;
  deleteTransfer: (id: string) => void;
  completeTransfer: (id: string) => Promise<void>;
  adjustStock: (input: {
    productId: string;
    type: MovementType;
    quantity: number;
    notes?: string;
    reference?: string;
  }) => Promise<void>;
};

const InventoryContext = createContext<ContextValue | null>(null);

/* -------------------------------- mappers -------------------------------- */

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));

const mapProduct = (r: any): ProductRecord => ({
  id: r.id, name: str(r.name), sku: str(r.sku), category: str(r.category),
  categoryId: str(r.category_id), supplierId: str(r.supplier_id), warehouseId: str(r.warehouse_id),
  sellingPrice: num(r.selling_price), costPrice: num(r.cost_price),
  stockQuantity: num(r.stock_quantity), reorderLevel: num(r.reorder_level),
  active: r.active !== false, description: str(r.description), imagePath: str(r.image_path),
});
const productRow = (r: Omit<ProductRecord, "id">) => ({
  name: r.name, sku: r.sku || null, category: r.category || null,
  category_id: r.categoryId || null, supplier_id: r.supplierId || null, warehouse_id: r.warehouseId || null,
  selling_price: r.sellingPrice, cost_price: r.costPrice,
  stock_quantity: r.stockQuantity, reorder_level: r.reorderLevel,
  active: r.active, description: r.description || null,
  ...(r.imagePath === undefined ? {} : { image_path: r.imagePath || null }),
});

const mapCategory = (r: any): CategoryRecord => ({ id: r.id, name: str(r.name), description: str(r.description) });
const categoryRow = (r: Omit<CategoryRecord, "id">) => ({ name: r.name, description: r.description || null });

const mapSupplier = (r: any): SupplierRecord => ({
  id: r.id, name: str(r.name), phone: str(r.phone),
  address: str(r.address), notes: str(r.notes), status: (r.status ?? "Active") as SupplierRecord["status"],
});
const supplierRow = (r: Omit<SupplierRecord, "id">) => ({
  name: r.name, phone: r.phone || null,
  address: r.address || null, notes: r.notes || null, status: r.status,
});

const mapWarehouse = (r: any): WarehouseRecord => ({
  id: r.id, name: str(r.name), location: str(r.location), manager: str(r.manager),
  capacity: num(r.capacity), status: (r.status ?? "Active") as WarehouseRecord["status"],
});
const warehouseRow = (r: Omit<WarehouseRecord, "id">) => ({
  name: r.name, location: r.location || null, manager: r.manager || null,
  capacity: r.capacity, status: r.status,
});

const mapPurchase = (r: any): InventoryPurchaseRecord => ({
  id: r.id, purchaseNo: str(r.purchase_no), supplierId: str(r.supplier_id),
  supplierName: str(r.supplier_name), warehouseId: str(r.warehouse_id),
  purchaseDate: str(r.purchase_date), total: num(r.total), notes: str(r.notes),
  status: (r.status ?? "Pending") as InventoryPurchaseRecord["status"],
});
const purchaseRow = (r: Omit<InventoryPurchaseRecord, "id">) => ({
  purchase_no: r.purchaseNo, supplier_id: r.supplierId || null, supplier_name: r.supplierName,
  warehouse_id: r.warehouseId || null, purchase_date: r.purchaseDate, total: r.total,
  notes: r.notes || null, status: r.status,
});

const mapItem = (r: any): PurchaseItemRecord => ({
  id: r.id, purchaseId: str(r.purchase_id), productId: str(r.product_id),
  productName: str(r.product_name), quantity: num(r.quantity),
  unitCost: num(r.unit_cost), lineTotal: num(r.line_total),
});

const mapTransfer = (r: any): TransferRecord => ({
  id: r.id, productId: str(r.product_id), productName: str(r.product_name),
  fromWarehouse: str(r.from_warehouse), toWarehouse: str(r.to_warehouse),
  quantity: num(r.quantity), notes: str(r.notes), transferDate: str(r.transfer_date),
  status: (r.status ?? "Pending") as TransferRecord["status"],
});
const transferRow = (r: Omit<TransferRecord, "id">) => ({
  product_id: r.productId || null, product_name: r.productName,
  from_warehouse: r.fromWarehouse, to_warehouse: r.toWarehouse,
  quantity: r.quantity, notes: r.notes || null, transfer_date: r.transferDate, status: r.status,
});

const mapMovement = (r: any): MovementRecord => ({
  id: r.id, productId: str(r.product_id), productName: str(r.product_name),
  type: (r.type ?? "Adjustment") as MovementType, quantity: num(r.quantity),
  reference: str(r.reference), notes: str(r.notes), movementDate: str(r.movement_date),
});

/* -------------------------------- provider -------------------------------- */

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [purchases, setPurchases] = useState<InventoryPurchaseRecord[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [movements, setMovements] = useState<MovementRecord[]>([]);

  const refresh = useCallback(async () => {
    const [p, c, s, w, pu, pi, t, m] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("product_categories").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("warehouses").select("*").order("name"),
      supabase.from("inventory_purchases").select("*").order("purchase_date", { ascending: false }),
      supabase.from("inventory_purchase_items").select("*"),
      supabase.from("stock_transfers").select("*").order("transfer_date", { ascending: false }),
      supabase.from("stock_movements").select("*").order("movement_date", { ascending: false }).limit(500),
    ]);
    setProducts((p.data ?? []).map(mapProduct));
    setCategories((c.data ?? []).map(mapCategory));
    setSuppliers((s.data ?? []).map(mapSupplier));
    setWarehouses((w.data ?? []).map(mapWarehouse));
    setPurchases((pu.data ?? []).map(mapPurchase));
    setPurchaseItems((pi.data ?? []).map(mapItem));
    setTransfers((t.data ?? []).map(mapTransfer));
    setMovements((m.data ?? []).map(mapMovement));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const makeSave = useCallback(
    <T,>(table: string, toRow: (record: T) => Record<string, unknown>) =>
      (record: T, id?: string) => {
        void (async () => {
          if (id) await supabase.from(table as any).update(toRow(record) as any).eq("id", id);
          else await supabase.from(table as any).insert(toRow(record) as any);
          await refresh();
        })();
      },
    [refresh],
  );

  const makeDelete = useCallback(
    (table: string) => (id: string) => {
      void (async () => {
        await supabase.from(table as any).delete().eq("id", id);
        await refresh();
      })();
    },
    [refresh],
  );

  const logMovement = useCallback(
    async (input: { productId: string; productName: string; type: MovementType; quantity: number; reference?: string; notes?: string }) => {
      await supabase.from("stock_movements").insert({
        product_id: input.productId || null,
        product_name: input.productName,
        type: input.type,
        quantity: input.quantity,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        movement_date: new Date().toISOString().slice(0, 10),
      } as any);
    },
    [],
  );

  const adjustStock = useCallback(
    async (input: { productId: string; type: MovementType; quantity: number; notes?: string; reference?: string }) => {
      const product = products.find((row) => row.id === input.productId);
      if (!product) return;
      const delta =
        input.type === "Stock Out" ? -Math.abs(input.quantity)
          : input.type === "Adjustment" ? input.quantity
            : Math.abs(input.quantity);
      const next = input.type === "Adjustment" && input.reference === "set"
        ? input.quantity
        : Math.max(0, product.stockQuantity + delta);
      await supabase.from("products").update({ stock_quantity: next } as any).eq("id", product.id);
      await logMovement({
        productId: product.id,
        productName: product.name,
        type: input.type,
        quantity: input.type === "Adjustment" && input.reference === "set" ? next - product.stockQuantity : delta,
        reference: input.reference,
        notes: input.notes,
      });
      await refresh();
    },
    [products, logMovement, refresh],
  );

  const savePurchase = useCallback(
    async (
      record: Omit<InventoryPurchaseRecord, "id">,
      items: Omit<PurchaseItemRecord, "id" | "purchaseId">[],
      id?: string,
    ) => {
      let purchaseId = id;
      if (id) {
        await supabase.from("inventory_purchases").update(purchaseRow(record) as any).eq("id", id);
        await supabase.from("inventory_purchase_items").delete().eq("purchase_id", id);
      } else {
        const { data } = await supabase.from("inventory_purchases").insert(purchaseRow(record) as any).select("id").single();
        purchaseId = (data as any)?.id;
      }
      if (purchaseId && items.length > 0) {
        await supabase.from("inventory_purchase_items").insert(
          items.map((item) => ({
            purchase_id: purchaseId,
            product_id: item.productId || null,
            product_name: item.productName,
            quantity: item.quantity,
            unit_cost: item.unitCost,
            line_total: item.lineTotal,
          })) as any,
        );
      }
      await refresh();
    },
    [refresh],
  );

  const receivePurchase = useCallback(
    async (id: string) => {
      const purchase = purchases.find((row) => row.id === id);
      if (!purchase || purchase.status === "Received") return;
      const items = purchaseItems.filter((item) => item.purchaseId === id);
      for (const item of items) {
        const product = products.find((row) => row.id === item.productId);
        if (product) {
          await supabase
            .from("products")
            .update({ stock_quantity: product.stockQuantity + item.quantity } as any)
            .eq("id", product.id);
        }
        await logMovement({
          productId: item.productId,
          productName: item.productName,
          type: "Purchase",
          quantity: item.quantity,
          reference: purchase.purchaseNo,
        });
      }
      await supabase.from("inventory_purchases").update({ status: "Received" } as any).eq("id", id);
      await refresh();
    },
    [purchases, purchaseItems, products, logMovement, refresh],
  );

  const completeTransfer = useCallback(
    async (id: string) => {
      const transfer = transfers.find((row) => row.id === id);
      if (!transfer || transfer.status === "Completed") return;
      await supabase.from("stock_transfers").update({ status: "Completed" } as any).eq("id", id);
      await logMovement({
        productId: transfer.productId,
        productName: transfer.productName,
        type: "Transfer",
        quantity: transfer.quantity,
        reference: `${transfer.fromWarehouse} → ${transfer.toWarehouse}`,
        notes: transfer.notes,
      });
      await refresh();
    },
    [transfers, logMovement, refresh],
  );

  const metrics = useMemo<InventoryMetrics>(() => {
    const totalStock = products.reduce((sum, item) => sum + item.stockQuantity, 0);
    return {
      totalProducts: products.length,
      totalStock,
      lowStock: products.filter((item) => stockStatus(item) === "Low Stock").length,
      outOfStock: products.filter((item) => stockStatus(item) === "Out of Stock").length,
      stockValue: products.reduce((sum, item) => sum + item.stockQuantity * item.costPrice, 0),
    };
  }, [products]);

  const value: ContextValue = {
    loading,
    products,
    categories,
    suppliers,
    warehouses,
    purchases,
    purchaseItems,
    transfers,
    movements,
    metrics,
    refresh,
    saveProduct: makeSave<Omit<ProductRecord, "id">>("products", productRow),
    deleteProduct: makeDelete("products"),
    saveCategory: makeSave<Omit<CategoryRecord, "id">>("product_categories", categoryRow),
    deleteCategory: makeDelete("product_categories"),
    saveSupplier: makeSave<Omit<SupplierRecord, "id">>("suppliers", supplierRow),
    deleteSupplier: makeDelete("suppliers"),
    saveWarehouse: makeSave<Omit<WarehouseRecord, "id">>("warehouses", warehouseRow),
    deleteWarehouse: makeDelete("warehouses"),
    savePurchase,
    deletePurchase: makeDelete("inventory_purchases"),
    receivePurchase,
    saveTransfer: makeSave<Omit<TransferRecord, "id">>("stock_transfers", transferRow),
    deleteTransfer: makeDelete("stock_transfers"),
    completeTransfer,
    adjustStock,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used inside InventoryProvider");
  return context;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );
}
