import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, SummaryStrip, TaxWorkspace } from "@/components/tax/tax-workspace";
import { RecordDialog } from "@/components/tax/record-dialog";
import { useState } from "react";
import {
  useCompliance, APPLICABILITY_LABEL, BUSINESS_TYPES, LEGAL_FORMS, SECTORS, TAX_REGISTRATIONS,
} from "@/components/compliance/compliance-provider";
import { Button } from "@/components/ui/button";
import { useBusinessProfile } from "@/hooks/use-business-profile";

export const Route = createFileRoute("/_authenticated/m/compliance/profile")({
  head: () => ({
    meta: [
      { title: "Business Profile — Compliance" },
      { name: "description", content: "The business profile that determines which compliance obligations apply." },
      { property: "og:title", content: "Business Profile — Compliance" },
      { property: "og:description", content: "Business type, sector, size, registrations and activity drive applicability." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, saveProfile, rules, applicability, metrics } = useCompliance();
  const [open, setOpen] = useState(false);
  const account = useBusinessProfile();

  const businessName = profile.name || account.name;
  const incomplete = metrics.profileCompleteness < 100;

  // Only obligations that concern THIS business: anything ruled out by the
  // registration details is hidden instead of being listed as noise.
  const relevant = rules.filter(
    (rule) => (applicability[rule.id]?.state ?? "requires_review") !== "not_applicable",
  );
  const applicable = relevant.filter((rule) => applicability[rule.id]?.state === "applicable");
  const toConfirm = relevant.filter((rule) => applicability[rule.id]?.state !== "applicable");

  return (
    <TaxWorkspace
      title="Business Profile"
      subtitle="Applicable compliance requirements are determined from this profile"
      icon={Building2}
      backTo="/m/compliance"
      backLabel="Back to Compliance"
      actions={<Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={() => setOpen(true)}>Edit profile</Button>}
    >
      <SummaryStrip
        items={[
          { label: "Business name", value: businessName || "Not set" },
          { label: "Phone", value: account.phone || "Not set" },
          { label: "Profile completeness", value: `${metrics.profileCompleteness}%`, tone: metrics.profileCompleteness === 100 ? "success" : "warning" },
          { label: "Business type", value: profile.businessType || "Not set" },
          { label: "Legal form", value: profile.legalForm || "Not set" },
          { label: "Sector", value: profile.sector || "Not set" },
          { label: "Employees", value: profile.employeeCount === null ? "Not set" : String(profile.employeeCount) },
          { label: "Import / export", value: `${profile.doesImport ? "Import" : "No import"} / ${profile.doesExport ? "Export" : "No export"}` },
          { label: "Tax registrations", value: profile.taxRegistrations.length ? profile.taxRegistrations.join(", ") : "None" },
          { label: "Applicable obligations", value: String(metrics.applicable) },
        ]}
      />

      {incomplete ? (
        <section className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-100">
            Some of your business registration details are missing. Complete the profile so the system
            shows only the requirements that apply to your business.
          </p>
          <Button size="sm" className="mt-3 h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={() => setOpen(true)}>
            Complete profile
          </Button>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
          Requirements for this business
        </h3>
        <ul className="mt-3 divide-y divide-white/[0.07]">
          {[...applicable, ...toConfirm].map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{rule.name}</p>
                <p className="text-xs text-white/50">{applicability[rule.id]?.reason}</p>
              </div>
              <StatusBadge value={APPLICABILITY_LABEL[applicability[rule.id]?.state ?? "requires_review"]} />
            </li>
          ))}
          {relevant.length === 0 ? (
            <li className="py-3 text-sm text-white/50">
              No requirements apply to your business with the details recorded so far.
            </li>
          ) : null}
        </ul>
      </section>

      <RecordDialog
        open={open}
        title="Business profile"
        description="Existing registration data is reused; these fields only refine compliance applicability."
        icon={Building2}
        fields={[
          { name: "name", label: "Business name", type: "text" },
          { name: "businessType", label: "Business type", type: "select", options: ["", ...BUSINESS_TYPES], half: true },
          { name: "legalForm", label: "Legal form", type: "select", options: ["", ...LEGAL_FORMS], half: true },
          { name: "sector", label: "Sector", type: "select", options: ["", ...SECTORS], half: true },
          { name: "employeeCount", label: "Number of employees", type: "number", half: true },
          { name: "taxRegistrations", label: `Tax registrations (${TAX_REGISTRATIONS.join(", ")})`, type: "text" },
          { name: "doesImport", label: "Imports goods", type: "switch", half: true },
          { name: "doesExport", label: "Exports goods", type: "switch", half: true },
        ]}
        initialValue={{
          name: profile.name, businessType: profile.businessType, legalForm: profile.legalForm,
          sector: profile.sector, employeeCount: profile.employeeCount ?? "",
          taxRegistrations: profile.taxRegistrations.join(", "),
          doesImport: profile.doesImport, doesExport: profile.doesExport,
        }}
        onClose={() => setOpen(false)}
        onSubmit={(values) => {
          const list = (value: unknown) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
          saveProfile({
            name: String(values["name"] ?? ""),
            businessType: String(values["businessType"] ?? ""),
            legalForm: String(values["legalForm"] ?? ""),
            sector: String(values["sector"] ?? ""),
            employeeCount: values["employeeCount"] === "" ? null : Number(values["employeeCount"]),
            taxRegistrations: list(values["taxRegistrations"]),
            doesImport: Boolean(values["doesImport"]),
            doesExport: Boolean(values["doesExport"]),
          });
          setOpen(false);
          toast.success("Profile updated — applicable obligations recalculated");
        }}
      />
    </TaxWorkspace>
  );
}
