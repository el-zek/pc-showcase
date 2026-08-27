import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { RecordDialog } from "@/components/tax/record-dialog";
import { useCompliance, FREQUENCIES, type ComplianceLicence } from "@/components/compliance/compliance-provider";
import { daysUntil } from "@/components/tax-module-provider";

export const Route = createFileRoute("/_authenticated/m/compliance/licences")({
  head: () => ({
    meta: [
      { title: "Licences & Permits — Bizz Automators" },
      { name: "description", content: "Track business licences, sector permits, renewals and expiry dates." },
      { property: "og:title", content: "Licences & Permits" },
      { property: "og:description", content: "Issue dates, expiry, renewal cycles and supporting documents." },
    ],
  }),
  component: LicencesPage,
});

function licenceStatus(row: ComplianceLicence) {
  if (row.status !== "Active") return row.status;
  if (!row.expiryDate) return "Active";
  const left = daysUntil(row.expiryDate);
  if (left < 0) return "Expired";
  if (left <= 30) return "Due Soon";
  return "Active";
}

function LicencesPage() {
  const { licences, saveLicence, deleteLicence } = useCompliance();
  const [editing, setEditing] = useState<ComplianceLicence | null>(null);
  const [open, setOpen] = useState(false);

  const expiring = licences.filter((row) => licenceStatus(row) === "Due Soon").length;
  const expired = licences.filter((row) => licenceStatus(row) === "Expired").length;

  return (
    <TaxWorkspace
      title="Licences & Permits"
      subtitle="Renewal cycles differ by requirement — expiry dates are optional"
      icon={BadgeCheck}
      backTo="/m/compliance"
      backLabel="Back to Compliance"
    >
      <SummaryStrip
        items={[
          { label: "Tracked items", value: String(licences.length) },
          { label: "Expiring soon", value: String(expiring), tone: "warning" },
          { label: "Expired", value: String(expired), tone: "danger" },
        ]}
      />

      <TaxTable
        rows={licences}
        columns={[
          { key: "name", label: "Licence / permit", render: (row) => (
            <div className="flex min-w-0 items-center gap-3">
              {row.imageUrl ? (
                <img src={row.imageUrl} alt={row.name} className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover" />
              ) : null}
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{row.name}</div>
                <div className="truncate text-xs text-white/50">{row.licenceType} · {row.authority || "Authority not set"}</div>
              </div>
            </div>
          ) },
          { key: "issueDate", label: "Issued", hideOnMobile: true, render: (row) => row.issueDate || "—" },
          { key: "expiryDate", label: "Expiry", hideOnMobile: true, render: (row) => row.expiryDate || "Does not expire" },
          { key: "renewal", label: "Renewal", hideOnMobile: true, render: (row) => (row.renewalRequired ? row.renewalFrequency : "Not renewable") },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={licenceStatus(row)} /> },
        ]}
        searchKeys={(row) => `${row.name} ${row.authority}`}
        onEdit={(row) => { setEditing(row); setOpen(true); }}
        onDelete={(row) => { deleteLicence(row.id); toast.success("Removed"); }}
        onExport={(rows) => exportCsv("compliance-licences.csv",
          ["Name", "Type", "Authority", "Issued", "Expiry", "Renewal", "Fee", "Status"],
          rows.map((row) => [row.name, row.licenceType, row.authority, row.issueDate, row.expiryDate, row.renewalRequired ? row.renewalFrequency : "Not renewable", row.feeAmount ?? "", licenceStatus(row)]))}
        addLabel="Add licence"
        onAdd={() => { setEditing(null); setOpen(true); }}
        empty={{ title: "No licences or permits recorded", description: "Add the licences and sector permits your business holds so renewals and expiry can be tracked.", icon: BadgeCheck }}
      />

      <RecordDialog
        open={open}
        title={editing ? "Edit licence / permit" : "Add licence / permit"}
        description="Switch on renewal to record expiry, renewal cycle and fee."
        icon={BadgeCheck}
        fields={[
          { name: "imageUrl", label: "Licence photo / scan", type: "image" },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "licenceType", label: "Type", type: "select", options: ["Licence", "Permit", "Registration", "Certificate"], half: true },
          { name: "authority", label: "Issuing authority", type: "text", half: true },
          { name: "issueDate", label: "Issue date", type: "date", half: true },
          { name: "status", label: "Status", type: "select", options: ["Active", "Pending", "Expired", "Suspended"], half: true },
          { name: "renewalRequired", label: "Renewal required", type: "switch", half: true },
          { name: "expiryDate", label: "Expiry date", type: "date", half: true, required: true, showIf: (values) => Boolean(values["renewalRequired"]) },
          { name: "renewalFrequency", label: "Renewal frequency", type: "select", options: FREQUENCIES, half: true, showIf: (values) => Boolean(values["renewalRequired"]) },
          { name: "feeAmount", label: "Fee", type: "number", half: true, required: true, showIf: (values) => Boolean(values["renewalRequired"]) },
        ]}
        initialValue={editing ? {
          imageUrl: editing.imageUrl ?? "",
          name: editing.name, licenceType: editing.licenceType, authority: editing.authority,
          issueDate: editing.issueDate, expiryDate: editing.expiryDate,
          renewalRequired: editing.renewalRequired, renewalFrequency: editing.renewalFrequency,
          feeAmount: editing.feeAmount ?? "", status: editing.status,
        } : null}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSubmit={(values) => {
          const renewalRequired = Boolean(values["renewalRequired"]);
          saveLicence({
            name: String(values["name"]),
            licenceType: values["licenceType"] as ComplianceLicence["licenceType"],
            authority: String(values["authority"] ?? ""),
            reference: editing?.reference ?? "",
            issueDate: String(values["issueDate"] ?? ""),
            expiryDate: renewalRequired ? String(values["expiryDate"] ?? "") : "",
            renewalRequired,
            renewalFrequency: (renewalRequired ? values["renewalFrequency"] : "Non-renewable") as ComplianceLicence["renewalFrequency"],
            feeAmount: renewalRequired && values["feeAmount"] !== "" ? Number(values["feeAmount"]) : null,
            paymentStatus: editing?.paymentStatus ?? "not_required",
            status: values["status"] as ComplianceLicence["status"],
            documentId: editing?.documentId ?? "",
            imageUrl: String(values["imageUrl"] ?? ""),
            notes: editing?.notes ?? "",
          }, editing?.id);
          setOpen(false); setEditing(null);
          toast.success("Saved");
        }}
      />
    </TaxWorkspace>
  );
}
