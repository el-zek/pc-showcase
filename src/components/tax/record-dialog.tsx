import { useEffect, useState, type ReactNode } from "react";
import { FileText, ShieldAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModernDialog, panelControlCls, panelLabelCls } from "@/components/ui/modern-dialog";


export type FieldValue = string | number | boolean;

export type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "switch" | "image";
  options?: string[];
  defaultValue?: FieldValue;
  required?: boolean;
  half?: boolean;
  /** Render the field only when this predicate passes for the current values. */
  showIf?: (values: Record<string, FieldValue>) => boolean;
};

export function RecordDialog({
  open, title, description, fields, initialValue, submitLabel = "Save", onSubmit, onClose, extra, blockSubmit, icon = FileText, onChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  fields: Field[];
  initialValue?: Record<string, FieldValue> | null;
  submitLabel?: string;
  onSubmit: (value: Record<string, FieldValue>) => void;
  onClose: () => void;
  extra?: ReactNode;
  blockSubmit?: string | null;
  icon?: LucideIcon;
  /** Optional live view of the current values, for pages that validate while typing. */
  onChange?: (values: Record<string, FieldValue>) => void;
}) {
  const build = () => {
    const next: Record<string, FieldValue> = {};
    for (const field of fields) {
      const provided = initialValue?.[field.name];
      next[field.name] =
        provided !== undefined
          ? provided
          : field.defaultValue !== undefined
            ? field.defaultValue
            : field.type === "switch"
              ? false
              : field.type === "select"
                ? (field.options?.[0] ?? "")
                : "";
    }
    return next;
  };

  const [values, setValues] = useState<Record<string, FieldValue>>(build);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(build());
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValue]);

  const set = (name: string, value: FieldValue) =>
    setValues((current) => {
      const next = { ...current, [name]: value };
      onChange?.(next);
      return next;
    });

  const activeFields = fields.filter((field) => !field.showIf || field.showIf(values));

  const missing = activeFields.filter((field) => field.required && (values[field.name] === "" || values[field.name] === undefined));

  const handleSubmit = () => {
    setTouched(true);
    if (missing.length > 0 || blockSubmit) return;
    onSubmit(values);
    onClose();
  };

  return (
    <ModernDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      footer={
        <>
          <Button
            variant="outline"
            className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
            onClick={onClose}
          >
            Cancel <X className="ml-1.5 h-4 w-4" />
          </Button>
          <Button className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {activeFields.map((field) => {
          const invalid = touched && field.required && values[field.name] === "";
          return (
            <div key={field.name} className={field.half ? "sm:col-span-1" : "sm:col-span-2"}>
              <Label className={panelLabelCls}>{field.label}</Label>
              {field.type === "select" ? (
                <Select value={String(values[field.name] ?? "")} onValueChange={(value) => set(field.name, value)}>
                  <SelectTrigger className={panelControlCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "image" ? (
                <div className="mt-2 space-y-2">
                  {values[field.name] ? (
                    <img
                      src={String(values[field.name])}
                      alt={field.label}
                      className="h-28 w-full rounded-xl border border-white/10 object-cover"
                    />
                  ) : null}
                  <Input
                    type="file"
                    accept="image/*"
                    className={panelControlCls}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => set(field.name, String(reader.result ?? ""));
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              ) : field.type === "switch" ? (
                <div className="mt-2 flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3">
                  <Switch checked={Boolean(values[field.name])} onCheckedChange={(checked) => set(field.name, checked)} />
                  <span className="text-sm text-white/70">{values[field.name] ? "Yes" : "No"}</span>
                </div>
              ) : (
                <Input
                  type={field.type}
                  value={String(values[field.name] ?? "")}
                  onChange={(event) => set(field.name, event.target.value)}
                  className={`${panelControlCls} ${invalid ? "border-rose-400/60" : ""}`}
                />
              )}
              {invalid ? <p className="mt-1 text-xs text-rose-300">{field.label} is required</p> : null}
            </div>
          );
        })}
      </div>

      {extra ? <div className="mt-4">{extra}</div> : null}
      {touched && blockSubmit ? <p className="mt-3 text-xs text-rose-300">{blockSubmit}</p> : null}
    </ModernDialog>
  );
}

export function ConfirmDialog({
  open, title, description, confirmLabel = "Delete", onConfirm, onClose,
}: { open: boolean; title: string; description: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <ModernDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={ShieldAlert}
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
            onClick={onClose}
          >
            Cancel <X className="ml-1.5 h-4 w-4" />
          </Button>
          <Button
            className="h-11 rounded-xl bg-rose-500 font-semibold text-white hover:bg-rose-400"
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-white/60">This action cannot be undone.</p>
    </ModernDialog>
  );
}

export const num = (value: FieldValue) => Number(value || 0);
export const str = (value: FieldValue) => String(value ?? "");
export const bool = (value: FieldValue) => Boolean(value);
