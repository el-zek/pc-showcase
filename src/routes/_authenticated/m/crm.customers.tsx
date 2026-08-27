import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, UserPlus, ChevronRight, Phone, LayoutList, LayoutGrid, Users } from "lucide-react";
import { toast } from "sonner";
import { CrmShell } from "@/components/crm/crm-shell";
import { TopDrawer, Field, inputCls } from "@/components/crm/top-drawer";

export const Route = createFileRoute("/_authenticated/m/crm/customers")({
  component: CustomersPage,
  validateSearch: (s: Record<string, unknown>): { new?: number } => (s.new ? { new: 1 } : {}),
});

const TYPES = ["retail", "wholesale", "vip", "corporate"] as const;
const STATUSES = ["active", "inactive"] as const;
const LIFECYCLE = ["prospect", "lead", "active_customer", "returning_customer", "inactive", "lost"] as const;
const SOURCES = ["Instagram", "Facebook", "Google", "TikTok", "WhatsApp", "Website", "Referral", "Walk-in", "Exhibition", "Visit", "Other"] as const;

const controlCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-amber-400/60";

function CustomersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/m/crm/customers" });

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"name" | "recent">("recent");
  const [view, setView] = useState<"list" | "grid">("list");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (search.new) setDrawerOpen(true);
  }, [search.new]);

  const { data: customers = [] } = useQuery({
    queryKey: ["crm-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let list = customers;
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((c: any) =>
        [c.name, c.phone, c.location].some((v) => (v ?? "").toString().toLowerCase().includes(s)),
      );
    }
    if (typeFilter !== "all") list = list.filter((c: any) => c.customer_type === typeFilter);
    if (statusFilter !== "all") list = list.filter((c: any) => c.status === statusFilter);
    if (sort === "name") list = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name));
    return list;
  }, [customers, q, typeFilter, statusFilter, sort]);

  const [form, setForm] = useState({
    name: "", phone: "", location: "", customer_type: "retail", status: "active", lifecycle_stage: "prospect", source: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => {
      const errs: Record<string, string> = {};
      if (!form.name.trim()) errs.name = "Name is required";
      setErrors(errs);
      if (Object.keys(errs).length) throw new Error("validation");
      const { data, error } = await supabase.from("customers").insert({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        location: form.location.trim() || null,
        customer_type: form.customer_type,
        status: form.status,
        lifecycle_stage: form.lifecycle_stage,
        source: form.source || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Customer added");
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      qc.invalidateQueries({ queryKey: ["crm-customers-all"] });
      qc.invalidateQueries({ queryKey: ["crm-hub-stats"] });
      setDrawerOpen(false);
      setForm({ name: "", phone: "", location: "", customer_type: "retail", status: "active", lifecycle_stage: "prospect", source: "" });
      navigate({ to: "/m/crm/customers", search: {} });
    },
    onError: (e: any) => e?.message !== "validation" && toast.error(e?.message ?? "Failed"),
  });

  return (
    <CrmShell
      plain
      title="All Customers"
      subtitle={`${filtered.length} of ${customers.length} customers`}
      action={
        <button
          onClick={() => setDrawerOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/70 px-5 py-3 text-sm font-semibold text-amber-400 transition hover:bg-amber-400/10 md:w-auto"
        >
          <UserPlus className="h-4 w-4" /> Add Customer
        </button>
      }
    >
      <>

          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, phone, location..."
                className={`${controlCls} pl-11`}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 lg:flex">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${controlCls} lg:w-40`}>
                <option value="all">All types</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${controlCls} lg:w-40`}>
                <option value="all">All status</option>
                {STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className={`${controlCls} lg:w-40`}>
                <option value="recent">Recent</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
            <button
              onClick={() => setView(view === "list" ? "grid" : "list")}
              className="hidden shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-amber-400 transition hover:bg-white/[0.07] lg:grid"
              aria-label="Toggle view"
            >
              {view === "list" ? <LayoutList className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center md:py-24">
              <div className="relative grid h-40 w-40 place-items-center rounded-full bg-white/[0.04]">
                <Users className="h-20 w-20 text-white/30" />
                <span className="absolute bottom-4 right-6 grid h-9 w-9 place-items-center rounded-full border-2 border-amber-400 text-amber-400">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
              <h2 className="mt-6 font-display text-2xl font-bold text-white">
                {customers.length === 0 ? "No customers yet" : "No matching customers"}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                {customers.length === 0
                  ? "You haven't added any customers yet. Add your first customer to get started."
                  : "Try changing your search or filters to find what you're looking for."}
              </p>
              <button
                onClick={() => setDrawerOpen(true)}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-black transition hover:bg-amber-300"
              >
                <UserPlus className="h-4 w-4" /> Add your first customer
              </button>
            </div>
          ) : (
            <div className={`mt-5 ${view === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-2"}`}>
              {filtered.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => navigate({ to: "/m/crm/customers/$id", params: { id: c.id } })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-400/15 font-bold text-amber-400">
                    {c.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-white">{c.name}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                        {c.customer_type}
                      </span>
                      {c.status === "inactive" && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase text-red-300">inactive</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/50">
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.location && <span>{c.location}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                </button>
              ))}
            </div>
          )}
      </>


      <TopDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); navigate({ to: "/m/crm/customers", search: {} }); }}
        title="New Customer"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setDrawerOpen(false)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Cancel</button>
            <button
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Save Customer
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Customer Name *" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Name" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+255 ..." />
          </Field>
          <Field label="Location">
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="Dar es Salaam" />
          </Field>
          <Field label="Customer Type">
            <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} className={inputCls}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              {STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Lifecycle stage">
            <select value={form.lifecycle_stage} onChange={(e) => setForm({ ...form, lifecycle_stage: e.target.value })} className={inputCls}>
              {LIFECYCLE.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputCls}>
              <option value="">Not recorded</option>{SOURCES.map((source) => <option key={source}>{source}</option>)}
            </select>
          </Field>
        </div>
      </TopDrawer>
    </CrmShell>
  );
}
