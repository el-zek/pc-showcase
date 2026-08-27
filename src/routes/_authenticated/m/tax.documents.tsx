import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FolderArchive, Upload, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaxModule, DOCUMENT_CATEGORIES, type DocumentRecord } from "@/components/tax-module-provider";
import { ConfirmDialog } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { buildEfdReceiptsPdf } from "@/lib/tax-pdf";

export const Route = createFileRoute("/_authenticated/m/tax/documents")({ component: DocumentsPage });

function DocumentsPage() {
  const { documents, deleteDocument, uploadDocument, documentUrl } = useTaxModule();
  const [detail, setDetail] = useState<DocumentRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null);
  const [category, setCategory] = useState<string>("Receipts");
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const efdReceipts = documents.filter((row) => row.category === "EFD Receipts");

  const pickFiles = () => fileInput.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, { category });
      }
      toast.success(`${files.length} document(s) uploaded to ${category}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const downloadEfdPdf = async () => {
    if (efdReceipts.length === 0) { toast.error("No EFD receipts saved yet"); return; }
    setBuilding(true);
    try {
      const entries = [];
      for (const doc of efdReceipts) {
        const url = await documentUrl(doc);
        if (url) entries.push({ title: doc.name, date: doc.uploadedAt, url });
      }
      await buildEfdReceiptsPdf(entries, `efd-receipts-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("EFD receipts PDF downloaded");
    } catch {
      toast.error("Could not build the receipts PDF");
    } finally {
      setBuilding(false);
    }
  };

  const openFile = async (doc: DocumentRecord) => {
    const url = await documentUrl(doc);
    if (!url) { toast.error("No file attached to this record"); return; }
    window.open(url, "_blank", "noopener");
  };

  return (
    <TaxWorkspace
      title="Document Center"
      subtitle="Upload tax documents from your device and archive EFD receipts"
      icon={FolderArchive}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[150px] border-white/15 bg-black/25 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOCUMENT_CATEGORIES.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={pickFiles} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />} Upload
          </Button>
          <Button size="sm" variant="outline" className="h-9 border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={downloadEfdPdf} disabled={building}>
            {building ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />} EFD receipts PDF
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf,.csv,.xlsx,.xls,.doc,.docx"
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </div>
      }
    >
      <SummaryStrip
        items={[
          { label: "Documents", value: String(documents.length), hint: "In archive", accent: true },
          { label: "EFD receipts", value: String(efdReceipts.length), hint: "Linked to sales" },
          { label: "Pending", value: String(documents.filter((row) => row.status === "Pending").length), hint: "Needs review" },
          { label: "Categories", value: String(new Set(documents.map((row) => row.category)).size), hint: "In use" },
        ]}
      />

      <div className="mt-4">
        <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Upload target</Label>
        <p className="mt-1 text-sm text-white/60">
          Files are stored securely in your business archive. Choose a category, then upload photos, PDFs or spreadsheets from this device.
        </p>
      </div>

      <TaxTable
        rows={documents}
        searchKeys={(row) => `${row.name} ${row.category} ${row.type} ${row.status}`}
        filter={{
          label: "Category",
          options: DOCUMENT_CATEGORIES.map((value) => ({ value, label: value })),
          match: (row, value) => row.category === value,
        }}
        columns={[
          { key: "name", label: "Document", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "category", label: "Category" },
          { key: "type", label: "Type", hideOnMobile: true },
          { key: "size", label: "Size", hideOnMobile: true },
          { key: "uploadedAt", label: "Uploaded", hideOnMobile: true },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "tax-documents.csv",
            ["Document", "Category", "Type", "Size", "Uploaded", "Status"],
            rows.map((row) => [row.name, row.category, row.type, row.size, row.uploadedAt, row.status]),
          )
        }
        addLabel="Upload document"
        onAdd={pickFiles}
        empty={{ title: "No documents", description: "Upload invoices, receipts and certificates from your device to build the archive.", icon: FolderArchive }}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Document details"
        rows={
          detail
            ? [
                { label: "Category", value: detail.category },
                { label: "Type", value: detail.type },
                { label: "Size", value: detail.size },
                { label: "Uploaded", value: detail.uploadedAt },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => void openFile(detail)}>Open file</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete document"
        description={`${pendingDelete?.name ?? ""} will be removed from the archive and storage.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteDocument(pendingDelete.id); toast.success("Document deleted"); } }}
      />
    </TaxWorkspace>
  );
}
