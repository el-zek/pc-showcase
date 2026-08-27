import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { useCompliance, deriveStatus, APPLICABILITY_LABEL } from "@/components/compliance/compliance-provider";

export const Route = createFileRoute("/_authenticated/m/compliance/reports")({
  head: () => ({
    meta: [
      { title: "Compliance Reports — Bizz Automators" },
      { name: "description", content: "Compliance position by category, with filing, payment and renewal gaps." },
      { property: "og:title", content: "Compliance Reports" },
      { property: "og:description", content: "Category breakdown of compliance status and outstanding actions." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { obligations, metrics } = useCompliance();
  const categories = Array.from(new Set(obligations.map((row) => row.category))).map((category) => {
    const rows = obligations.filter((row) => row.category === category);
    const status = rows.map(deriveStatus);
    return {
      id: category,
      category,
      applicable: rows.filter((row) => row.applicability === "applicable").length,
      review: rows.filter((row) => row.applicability === "requires_review").length,
      compliant: status.filter((value) => value === "Compliant").length,
      overdue: status.filter((value) => value === "Overdue" || value === "Expired").length,
      total: rows.length,
    };
  });

  return (
    <TaxWorkspace
      title="Compliance Reports"
      subtitle="Position by category — gaps are shown as gaps, not as assumptions"
      icon={BarChart3}
      backTo="/m/compliance"
      backLabel="Back to Compliance"
    >
      <SummaryStrip
        items={[
          { label: "Obligations tracked", value: String(metrics.total) },
          { label: "Compliant", value: String(metrics.compliant), tone: "success" },
          { label: "Overdue / expired", value: String(metrics.overdue + metrics.expired), tone: "danger" },
          { label: "Requires review", value: String(metrics.review), tone: "warning" },
          { label: "Outstanding filings", value: String(metrics.outstandingFilings) },
          { label: "Outstanding payments", value: String(metrics.outstandingPayments) },
        ]}
      />
      <TaxTable
        rows={categories}
        columns={[
          { key: "category", label: "Category" },
          { key: "total", label: "Tracked", hideOnMobile: true },
          { key: "applicable", label: "Applicable", hideOnMobile: true },
          { key: "review", label: "Review", hideOnMobile: true, render: (row) => <StatusBadge value={row.review ? APPLICABILITY_LABEL["requires_review"] : "Clear"} /> },
          { key: "compliant", label: "Compliant" },
          { key: "overdue", label: "Overdue" },
        ]}
        searchKeys={(row) => row.category}
        onExport={(rows) => exportCsv("compliance-report.csv", ["Category", "Tracked", "Applicable", "Requires review", "Compliant", "Overdue"],
          rows.map((row) => [row.category, row.total, row.applicable, row.review, row.compliant, row.overdue]))}
        empty={{ title: "Nothing to report yet", description: "Configure rules and complete your business profile first.", icon: BarChart3 }}
      />
    </TaxWorkspace>
  );
}
