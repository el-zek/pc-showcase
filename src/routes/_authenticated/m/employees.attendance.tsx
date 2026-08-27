import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHr, today, type AttendanceStatus, type HrAttendance } from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/attendance")({ component: AttendancePage });

const statusLabel: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  on_leave: "On Leave",
};

function AttendancePage() {
  const { attendance, employees, departments, employeeName, employee, saveAttendance, removeAttendance } = useHr();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrAttendance | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HrAttendance | null>(null);
  const [date, setDate] = useState(today());

  const rows = useMemo(
    () => [...attendance].sort((a, b) => (a.date === b.date ? employeeName(a.employeeId).localeCompare(employeeName(b.employeeId)) : b.date.localeCompare(a.date))),
    [attendance, employeeName],
  );

  const forDate = attendance.filter((row) => row.date === date);
  const count = (status: AttendanceStatus) => forDate.filter((row) => row.status === status).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const employeeId = employees.find((row) => row.name === str(value.employee))?.id;
    if (!employeeId) { toast.error("Select an employee"); return; }
    saveAttendance(
      {
        employeeId,
        date: str(value.date) || today(),
        checkIn: str(value.checkIn),
        checkOut: str(value.checkOut),
        hours: num(value.hours),
        status: str(value.status) as AttendanceStatus,
      },
      editing?.id,
    );
    toast.success(editing ? "Attendance updated" : "Attendance recorded");
  };

  return (
    <TaxWorkspace
      title="Attendance"
      subtitle="Daily time records that drive payroll deductions"
      icon={Clock}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white outline-none focus:border-amber-300/50"
          />
          <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Record attendance
          </Button>
        </>
      }
    >
      <SummaryStrip
        items={[
          { label: "Present Today", value: String(count("present")), hint: date, tone: "success" },
          { label: "Absent", value: String(count("absent")), tone: count("absent") > 0 ? "danger" : "default" },
          { label: "Late", value: String(count("late")), tone: "warning" },
          { label: "On Leave", value: String(count("on_leave")) },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${employeeName(row.employeeId)} ${row.date} ${row.status}`}
        filter={{
          label: "Filter",
          options: [
            ...(["present", "absent", "late", "on_leave"] as AttendanceStatus[]).map((status) => ({ value: status, label: statusLabel[status] })),
            ...departments.map((dept) => ({ value: `dept:${dept.id}`, label: dept.name })),
            { value: `date:${date}`, label: `Date: ${date}` },
          ],
          match: (row, value) => {
            if (value.startsWith("dept:")) return employee(row.employeeId)?.departmentId === value.slice(5);
            if (value.startsWith("date:")) return row.date === value.slice(5);
            return row.status === value;
          },
        }}
        columns={[
          { key: "employee", label: "Employee", render: (row) => <span className="font-medium text-white">{employeeName(row.employeeId)}</span> },
          { key: "date", label: "Date" },
          { key: "checkIn", label: "Check In", hideOnMobile: true, render: (row) => row.checkIn || "—" },
          { key: "checkOut", label: "Check Out", hideOnMobile: true, render: (row) => row.checkOut || "—" },
          { key: "hours", label: "Hours", hideOnMobile: true, render: (row) => row.hours.toFixed(1) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={statusLabel[row.status]} /> },
        ]}
        onEdit={(row) => { setEditing(row); setFormOpen(true); }}
        onDelete={(row) => setPendingDelete(row)}
        onExport={(exported) =>
          exportCsv(
            "attendance.csv",
            ["Employee", "Date", "Check In", "Check Out", "Hours", "Status"],
            exported.map((row) => [employeeName(row.employeeId), row.date, row.checkIn, row.checkOut, row.hours, statusLabel[row.status]]),
          )
        }
        addLabel="Record attendance"
        onAdd={openCreate}
        empty={{ title: "No attendance records", description: "Record daily check-ins so payroll can calculate accurately.", icon: Clock }}
      />

      <RecordDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit attendance" : "Record attendance"}
        description="Approved leave is written here automatically."
        icon={Clock}
        submitLabel={editing ? "Save changes" : "Save record"}
        initialValue={
          editing
            ? {
                employee: employeeName(editing.employeeId),
                date: editing.date,
                checkIn: editing.checkIn,
                checkOut: editing.checkOut,
                hours: editing.hours,
                status: editing.status,
              }
            : { date }
        }
        fields={[
          { name: "employee", label: "Employee", type: "select", options: employees.map((row) => row.name), required: true },
          { name: "date", label: "Date", type: "date", half: true, defaultValue: date },
          { name: "status", label: "Status", type: "select", options: ["present", "absent", "late", "on_leave"], half: true },
          { name: "checkIn", label: "Check in", type: "text", half: true },
          { name: "checkOut", label: "Check out", type: "text", half: true },
          { name: "hours", label: "Hours worked", type: "number", half: true },
        ]}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove attendance record"
        description="Payroll for the affected period will recalculate on the next run."
        onConfirm={() => { if (pendingDelete) { removeAttendance(pendingDelete.id); toast.success("Record removed"); } }}
      />
    </TaxWorkspace>
  );
}
