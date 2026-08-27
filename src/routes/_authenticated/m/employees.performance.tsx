import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Award, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHr, currentPeriod, periodLabel, today, type HrReview } from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/performance")({ component: PerformancePage });

const ratings = ["Outstanding", "Exceeds", "Meets", "Needs improvement"];

function PerformancePage() {
  const { reviews, employees, employeeName, employee, departmentName, saveReview, removeReview } = useHr();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrReview | null>(null);
  const [detail, setDetail] = useState<HrReview | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HrReview | null>(null);

  const rows = useMemo(
    () => [...reviews].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate)),
    [reviews],
  );

  const totals = useMemo(() => {
    const completed = reviews.filter((row) => row.status === "completed");
    const avg = reviews.length ? reviews.reduce((sum, row) => sum + row.kpiScore, 0) / reviews.length : 0;
    const top = reviews.filter((row) => row.kpiScore >= 80).length;
    return { completed: completed.length, pending: reviews.length - completed.length, avg, top };
  }, [reviews]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const employeeId = employees.find((row) => row.name === str(value.employee))?.id;
    if (!employeeId) { toast.error("Select an employee"); return; }
    saveReview(
      {
        employeeId,
        period: str(value.period) || currentPeriod(),
        kpiScore: num(value.kpiScore),
        rating: str(value.rating) || "Meets",
        reviewer: str(value.reviewer),
        reviewDate: str(value.reviewDate) || today(),
        status: (str(value.status) as HrReview["status"]) || "pending",
      },
      editing?.id,
    );
    toast.success(editing ? "Review updated" : "Review recorded");
  };

  return (
    <TaxWorkspace
      title="Performance"
      subtitle="KPI scores and appraisal tracking per employee"
      icon={Award}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New review
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Reviews", value: String(reviews.length) },
          { label: "Average KPI", value: `${totals.avg.toFixed(1)}%`, accent: true },
          { label: "Top Performers", value: String(totals.top), hint: "KPI 80%+", tone: "success" },
          { label: "Pending Reviews", value: String(totals.pending), tone: totals.pending > 0 ? "warning" : "default" },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${employeeName(row.employeeId)} ${row.period} ${row.rating} ${row.reviewer}`}
        filter={{
          label: "Status",
          options: [
            { value: "pending", label: "Pending" },
            { value: "completed", label: "Completed" },
            ...ratings.map((rating) => ({ value: `rating:${rating}`, label: rating })),
          ],
          match: (row, value) => (value.startsWith("rating:") ? row.rating === value.slice(7) : row.status === value),
        }}
        columns={[
          { key: "employee", label: "Employee", render: (row) => <span className="font-medium text-white">{employeeName(row.employeeId)}</span> },
          { key: "period", label: "Period", render: (row) => periodLabel(row.period) },
          { key: "kpiScore", label: "KPI", render: (row) => <span className="font-semibold text-white">{row.kpiScore.toFixed(0)}%</span> },
          { key: "rating", label: "Rating", hideOnMobile: true },
          { key: "reviewer", label: "Reviewer", hideOnMobile: true, render: (row) => row.reviewer || "—" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status === "completed" ? "Completed" : "Pending"} /> },
        ]}
        onRowClick={(row) => setDetail(row)}
        onEdit={(row) => { setEditing(row); setFormOpen(true); }}
        onDelete={(row) => setPendingDelete(row)}
        onExport={(exported) =>
          exportCsv(
            "performance-reviews.csv",
            ["Employee", "Department", "Period", "KPI", "Rating", "Reviewer", "Review date", "Status"],
            exported.map((row) => [
              employeeName(row.employeeId),
              departmentName(employee(row.employeeId)?.departmentId ?? null),
              row.period,
              row.kpiScore,
              row.rating,
              row.reviewer,
              row.reviewDate,
              row.status,
            ]),
          )
        }
        addLabel="New review"
        onAdd={openCreate}
        empty={{ title: "No performance reviews", description: "Record KPI scores so appraisals and HR reports stay up to date.", icon: Award }}
      />

      <RecordDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit review" : "New performance review"}
        description="KPI scores feed the HR performance analytics."
        icon={Award}
        submitLabel={editing ? "Save changes" : "Save review"}
        initialValue={
          editing
            ? {
                employee: employeeName(editing.employeeId),
                period: editing.period,
                kpiScore: editing.kpiScore,
                rating: editing.rating,
                reviewer: editing.reviewer,
                reviewDate: editing.reviewDate,
                status: editing.status,
              }
            : { period: currentPeriod(), reviewDate: today() }
        }
        fields={[
          { name: "employee", label: "Employee", type: "select", options: employees.map((row) => row.name), required: true },
          { name: "period", label: "Period (YYYY-MM)", type: "text", half: true, defaultValue: currentPeriod() },
          { name: "reviewDate", label: "Review date", type: "date", half: true, defaultValue: today() },
          { name: "kpiScore", label: "KPI score (%)", type: "number", half: true },
          { name: "rating", label: "Rating", type: "select", options: ratings, half: true },
          { name: "reviewer", label: "Reviewer", type: "text", half: true },
          { name: "status", label: "Status", type: "select", options: ["pending", "completed"], half: true },
        ]}
        onSubmit={submit}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? employeeName(detail.employeeId) : ""}
        description={detail ? `Review · ${periodLabel(detail.period)}` : undefined}
        icon={Award}
        rows={
          detail
            ? [
                { label: "Department", value: departmentName(employee(detail.employeeId)?.departmentId ?? null) },
                { label: "KPI score", value: `${detail.kpiScore.toFixed(0)}%` },
                { label: "Rating", value: detail.rating },
                { label: "Reviewer", value: detail.reviewer || "—" },
                { label: "Review date", value: detail.reviewDate },
                { label: "Status", value: <StatusBadge value={detail.status === "completed" ? "Completed" : "Pending"} /> },
              ]
            : []
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove review"
        description="This appraisal record will be deleted from performance analytics."
        onConfirm={() => { if (pendingDelete) { removeReview(pendingDelete.id); toast.success("Review removed"); } }}
      />
    </TaxWorkspace>
  );
}
