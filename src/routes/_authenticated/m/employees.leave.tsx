import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHr, daysBetween, today, type HrLeave, type LeaveStatus } from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/leave")({ component: LeavePage });

const LEAVE_TYPES = ["annual", "sick", "maternity", "unpaid", "compassionate"];

function LeavePage() {
  const { leave, employees, employeeName, saveLeave, setLeaveStatus, removeLeave } = useHr();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrLeave | null>(null);
  const [detail, setDetail] = useState<HrLeave | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HrLeave | null>(null);

  const count = (status: LeaveStatus) => leave.filter((row) => row.status === status).length;
  const day = today();
  const onLeaveNow = leave.filter((row) => row.status === "approved" && row.startDate <= day && row.endDate >= day).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const employeeId = employees.find((row) => row.name === str(value.employee))?.id;
    if (!employeeId) { toast.error("Select an employee"); return; }
    const startDate = str(value.startDate) || day;
    const endDate = str(value.endDate) || startDate;
    saveLeave(
      {
        employeeId,
        leaveType: str(value.leaveType),
        startDate,
        endDate,
        days: daysBetween(startDate, endDate),
        status: str(value.status) as LeaveStatus,
        reason: str(value.reason) || undefined,
      },
      editing?.id,
    );
    toast.success(editing ? "Leave request updated" : "Leave request created");
  };

  return (
    <TaxWorkspace
      title="Leave Requests"
      subtitle="Approvals flow straight into attendance and payroll"
      icon={CalendarDays}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New request
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Pending", value: String(count("pending")), tone: count("pending") > 0 ? "warning" : "default" },
          { label: "Approved", value: String(count("approved")), tone: "success" },
          { label: "Rejected", value: String(count("rejected")), tone: count("rejected") > 0 ? "danger" : "default" },
          { label: "Employees On Leave", value: String(onLeaveNow), accent: true },
        ]}
      />

      <TaxTable
        rows={leave}
        searchKeys={(row) => `${employeeName(row.employeeId)} ${row.leaveType} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "employee", label: "Employee", render: (row) => <span className="font-medium text-white">{employeeName(row.employeeId)}</span> },
          { key: "leaveType", label: "Leave Type", render: (row) => row.leaveType },
          { key: "startDate", label: "Start Date", hideOnMobile: true },
          { key: "endDate", label: "End Date", hideOnMobile: true },
          { key: "days", label: "Duration", hideOnMobile: true, render: (row) => `${row.days} day${row.days === 1 ? "" : "s"}` },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status === "pending" ? "Pending" : row.status === "approved" ? "Approved" : "Cancelled"} /> },
        ]}
        onRowClick={(row) => setDetail(row)}
        onEdit={(row) => { setEditing(row); setFormOpen(true); }}
        onDelete={(row) => setPendingDelete(row)}
        rowActions={(row) => [
          { label: "View", onSelect: () => setDetail(row) },
          ...(row.status !== "approved"
            ? [{ label: "Approve", onSelect: () => { setLeaveStatus(row.id, "approved"); toast.success("Leave approved — attendance updated"); } }]
            : []),
          ...(row.status !== "rejected"
            ? [{ label: "Reject", onSelect: () => { setLeaveStatus(row.id, "rejected"); toast.success("Leave rejected"); }, danger: true }]
            : []),
        ]}
        onExport={(exported) =>
          exportCsv(
            "leave-requests.csv",
            ["Employee", "Type", "Start", "End", "Days", "Status"],
            exported.map((row) => [employeeName(row.employeeId), row.leaveType, row.startDate, row.endDate, row.days, row.status]),
          )
        }
        addLabel="New request"
        onAdd={openCreate}
        empty={{ title: "No leave requests", description: "Capture leave so attendance and payroll stay accurate.", icon: CalendarDays }}
      />

      <RecordDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit leave request" : "New leave request"}
        description="Approved leave marks attendance and reduces payable days."
        icon={CalendarDays}
        submitLabel={editing ? "Save changes" : "Create request"}
        initialValue={
          editing
            ? {
                employee: employeeName(editing.employeeId),
                leaveType: editing.leaveType,
                startDate: editing.startDate,
                endDate: editing.endDate,
                status: editing.status,
                reason: editing.reason ?? "",
              }
            : null
        }
        fields={[
          { name: "employee", label: "Employee", type: "select", options: employees.map((row) => row.name), required: true },
          { name: "leaveType", label: "Leave type", type: "select", options: LEAVE_TYPES, half: true },
          { name: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"], half: true },
          { name: "startDate", label: "Start date", type: "date", half: true, defaultValue: day },
          { name: "endDate", label: "End date", type: "date", half: true, defaultValue: day },
          { name: "reason", label: "Reason", type: "text" },
        ]}
        onSubmit={submit}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? employeeName(detail.employeeId) : ""}
        description={detail ? `${detail.leaveType} leave` : undefined}
        icon={CalendarDays}
        rows={
          detail
            ? [
                { label: "Start date", value: detail.startDate },
                { label: "End date", value: detail.endDate },
                { label: "Duration", value: `${detail.days} day${detail.days === 1 ? "" : "s"}` },
                { label: "Status", value: <StatusBadge value={detail.status === "approved" ? "Approved" : detail.status === "pending" ? "Pending" : "Cancelled"} /> },
                { label: "Reason", value: detail.reason ?? "—" },
              ]
            : []
        }
        footer={
          detail && detail.status === "pending" ? (
            <>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
                onClick={() => { setLeaveStatus(detail.id, "rejected"); setDetail(null); toast.success("Leave rejected"); }}
              >
                Reject
              </Button>
              <Button
                className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
                onClick={() => { setLeaveStatus(detail.id, "approved"); setDetail(null); toast.success("Leave approved — attendance updated"); }}
              >
                Approve
              </Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove leave request"
        description="Attendance entries already created stay in place."
        onConfirm={() => { if (pendingDelete) { removeLeave(pendingDelete.id); toast.success("Request removed"); } }}
      />
    </TaxWorkspace>
  );
}
