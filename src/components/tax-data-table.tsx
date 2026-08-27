import { useMemo, useState, type ReactNode } from "react";
import { Search, Filter, Plus, Pencil, Trash2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TaxDataTable<T extends { id: string; [key: string]: unknown }>({
  title,
  rows,
  columns,
  onAdd,
  onEdit,
  onDelete,
  emptyText,
  emptyActionLabel,
}: {
  title: string;
  rows: T[];
  columns: { key: keyof T; label: string; render?: (row: T) => ReactNode }[];
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyText: string;
  emptyActionLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const term = query.toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = Object.values(row).some((value) => String(value).toLowerCase().includes(term));
      const matchesFilter = filter === "all" || String(row[columns[0].key] ?? "").toLowerCase() === filter.toLowerCase();
      return matchesQuery && matchesFilter;
    });
  }, [columns, filter, query, rows]);

  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/65">Search, filter and manage records quickly.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-2 py-1">
            <Search className="h-4 w-4 text-white/60" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-8 w-32 border-0 bg-transparent px-0 text-sm text-white placeholder:text-white/40 focus-visible:ring-0" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-36 border-white/15 bg-black/20 text-sm text-white">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          {onAdd ? (
            <Button size="sm" onClick={onAdd} className="bg-amber-400 text-black hover:bg-amber-300">
              <Plus className="h-4 w-4" /> {emptyActionLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-center text-sm text-white/70">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm text-white/80">
            <thead className="bg-black/25 text-white/70">
              <tr>
                {columns.map((column) => (
                  <th key={String(column.key)} className="px-3 py-3 font-medium">{column.label}</th>
                ))}
                {(onEdit || onDelete) ? <th className="px-3 py-3 text-right font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-white/10 bg-white/5">
                  {columns.map((column) => (
                    <td key={String(column.key)} className="px-3 py-3">
                      {column.render ? column.render(row) : <span>{String(row[column.key] ?? "")}</span>}
                    </td>
                  ))}
                  {(onEdit || onDelete) ? (
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {onEdit ? (
                          <button onClick={() => onEdit(row)} className="rounded-lg border border-white/10 bg-white/10 p-2 text-white/70 hover:bg-white/20">
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button onClick={() => onDelete(row)} className="rounded-lg border border-white/10 bg-white/10 p-2 text-white/70 hover:bg-white/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
