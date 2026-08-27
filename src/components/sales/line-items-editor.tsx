import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buildLine, formatMoney, type LineItem, type SalesProduct } from "@/components/sales/sales-provider";

/** Human readable specification line for a product, sourced from Inventory. */
export function productSpec(product: Pick<SalesProduct, "category" | "sku" | "description">) {
  return [product.category, product.sku ? `SKU ${product.sku}` : "", product.description]
    .filter(Boolean)
    .join(" · ");
}

export function LineItemsEditor({
  products,
  items,
  onChange,
}: {
  products: SalesProduct[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products.slice(0, 6);
    return products
      .filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [products, query]);

  const add = (product: SalesProduct) => {
    const existing = items.find((item) => item.productId === product.id);
    if (existing) {
      setQuantity(product.id, existing.quantity + 1);
      return;
    }
    onChange([...items, buildLine(product, 1)]);
  };

  const setQuantity = (productId: string, quantity: number) => {
    const product = products.find((row) => row.id === productId);
    if (!product) return;
    if (quantity <= 0) {
      onChange(items.filter((item) => item.productId !== productId));
      return;
    }
    onChange(
      items.map((item) => (item.productId === productId ? buildLine(product, quantity, item.unitPrice) : item)),
    );
  };

  const setPrice = (productId: string, unitPrice: number) => {
    const product = products.find((row) => row.id === productId);
    if (!product) return;
    onChange(items.map((item) => (item.productId === productId ? buildLine(product, item.quantity, unitPrice) : item)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3">
        <Search className="h-4 w-4 shrink-0 text-white/50" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product by name, SKU or category"
          className="h-9 border-0 bg-transparent px-0 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {results.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => add(product)}
            className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-left text-xs text-white transition hover:bg-amber-400/20"
          >
            <span className="block font-semibold">{product.name}</span>
            <span className="block text-white/55">
              {formatMoney(product.sellingPrice)} · stock {product.stockQuantity}
            </span>
          </button>
        ))}
        {results.length === 0 ? <p className="text-xs text-white/50">No products found in Inventory.</p> : null}
      </div>

      <div className="rounded-2xl border border-white/15 bg-black/20">
        {items.length === 0 ? (
          <p className="p-4 text-xs text-white/50">No items yet — search above and tap a product to add it.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.map((item) => {
              const product = products.find((row) => row.id === item.productId);
              return (
                <li key={item.productId} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.productName}</p>
                      {product ? <p className="truncate text-[11px] text-white/50">{productSpec(product)}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, 0)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-rose-200 transition hover:bg-rose-400/20"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/80"
                        aria-label="Less"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm text-white">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/80"
                        aria-label="More"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(event) => setPrice(item.productId, Number(event.target.value))}
                      className="h-8 w-28 border-white/15 bg-black/25 text-sm text-white"
                    />
                    <span className="ml-auto text-sm font-semibold text-amber-300">{formatMoney(item.lineTotal)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
