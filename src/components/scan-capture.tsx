import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Package, FolderArchive, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModernDialog, panelLabelCls, panelSectionCls } from "@/components/ui/modern-dialog";
import { supabase } from "@/integrations/supabase/client";

const DOC_CATEGORIES = ["EFD Receipts", "Receipts", "Invoices", "Certificates", "Returns", "Other"];

type Target = "product" | "document";

const humanSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

export function ScanCaptureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>("product");
  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("Receipts");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setBusy(false);
      return;
    }
    void supabase
      .from("products")
      .select("id,name")
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []).map((row: any) => ({ id: String(row.id), name: String(row.name) }));
        setProducts(list);
        setProductId((current) => current || list[0]?.id || "");
      });
    // open the camera straight away
    const timer = setTimeout(() => inputRef.current?.click(), 250);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const save = async () => {
    if (!file) { toast.error("Take a photo first"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      if (target === "product") {
        if (!productId) throw new Error("Choose a product first");
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (uploadError) throw uploadError;
        const { error } = await supabase.from("products").update({ image_path: path } as any).eq("id", productId);
        if (error) throw error;
        toast.success("Photo added to product");
      } else {
        const folder = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("tax-documents")
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (uploadError) throw uploadError;
        const { error } = await supabase.from("tax_documents").insert({
          name: file.name || `Scan ${new Date().toISOString().slice(0, 10)}`,
          category,
          type: "Image",
          size: humanSize(file.size),
          status: "Pending",
          uploaded_at: new Date().toISOString().slice(0, 10),
          file_path: path,
        } as any);
        if (error) throw error;
        toast.success(`Scan saved to ${category}`);
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the scan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModernDialog open={open} onClose={onClose} title="Scan" description="Take a photo and attach it where you need it." icon={Camera}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <div className={panelSectionCls}>
        {preview ? (
          <div className="space-y-3">
            <img src={preview} alt="Captured scan preview" className="max-h-56 w-full rounded-xl object-contain" />
            <Button variant="outline" className="h-10 w-full rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => inputRef.current?.click()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retake photo
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-amber-300/30 bg-amber-400/10 px-4 py-8 text-amber-200"
          >
            <Camera className="h-7 w-7" />
            <span className="text-sm font-medium">Open camera</span>
            <span className="text-xs text-white/50">Or choose an image from this device</span>
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <Label className={panelLabelCls}>Attach to</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([
              { value: "product" as Target, label: "Product photo", icon: Package },
              { value: "document" as Target, label: "Document Center", icon: FolderArchive },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTarget(option.value)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                  target === option.value
                    ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                    : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                <option.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {target === "product" ? (
          <div>
            <Label className={panelLabelCls}>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white">
                <SelectValue placeholder={products.length ? "Choose product" : "No products yet"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((row) => (
                  <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label className={panelLabelCls}>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={onClose}>Cancel</Button>
        <Button className="h-11 rounded-xl bg-amber-400 text-black hover:bg-amber-300" onClick={() => void save()} disabled={busy || !file}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Save scan
        </Button>
      </div>
    </ModernDialog>
  );
}
