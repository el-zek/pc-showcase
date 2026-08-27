import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit2, Radio } from "lucide-react";
import { toast } from "sonner";
import { CrmShell, GlassCard } from "@/components/crm/crm-shell";
import { TopDrawer, Field, inputCls } from "@/components/crm/top-drawer";

export const Route = createFileRoute("/_authenticated/m/crm/channels")({ component: ChannelsPage });

const TYPES = ["digital", "social", "messaging", "word_of_mouth", "physical", "ads", "other"] as const;
type Form = { name: string; type: string; notes: string; active: boolean };
const empty: Form = { name: "", type: "digital", notes: "", active: true };

function ChannelsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const { data: channels = [] } = useQuery({
    queryKey: ["crm-channels"],
    queryFn: async () => (await supabase.from("customer_channels").select("*").order("name")).data ?? [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["crm-channels-customers"],
    queryFn: async () => (await supabase.from("customers").select("channel_id")).data ?? [],
  });

  const counts = new Map<string, number>();
  for (const c of customers as any[]) if (c.channel_id) counts.set(c.channel_id, (counts.get(c.channel_id) ?? 0) + 1);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const payload = { name: form.name.trim(), type: form.type, notes: form.notes || null, active: form.active };
      const { error } = editing
        ? await supabase.from("customer_channels").update(payload).eq("id", editing.id)
        : await supabase.from("customer_channels").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Channel added");
      qc.invalidateQueries({ queryKey: ["crm-channels"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, type: c.type, notes: c.notes ?? "", active: c.active }); setOpen(true); };

  return (
    <CrmShell
      title="Reach Channels"
      subtitle="How customers find you"
      action={
        <button onClick={openCreate} className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold hover:bg-amber-400/30">
          <Plus className="h-4 w-4" /> Add Channel
        </button>
      }
    >
      {(channels as any[]).length === 0 && (
        <GlassCard className="p-8 text-center text-white/70">No channels yet. Add one to start tracking where customers come from.</GlassCard>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(channels as any[]).map((c) => (
          <GlassCard key={c.id} className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/20"><Radio className="h-5 w-5 text-amber-400" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/60">{c.type.replace(/_/g, " ")}</p>
              </div>
              <button onClick={() => openEdit(c)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 hover:bg-white/20"><Edit2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/60">Customers</p>
                <p className="font-display text-2xl font-bold leading-none">{counts.get(c.id) ?? 0}</p>
              </div>
              {c.active ? (
                <span className="rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Active</span>
              ) : (
                <span className="rounded-full bg-red-500/15 text-red-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Inactive</span>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      <TopDrawer
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? "Edit Channel" : "New Channel"}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm">Cancel</button>
            <button disabled={save.isPending} onClick={() => save.mutate()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50">Save</button>
          </div>
        }
      >
        <div className="grid gap-4">
          <Field label="Channel Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + " min-h-20"} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
        </div>
      </TopDrawer>
    </CrmShell>
  );
}
