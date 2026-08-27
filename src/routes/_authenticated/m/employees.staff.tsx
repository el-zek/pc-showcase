import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import {
  useHr, employmentLabel, today,
  type HrEmployee, type EmployeeStatus, type EmploymentType,
} from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/staff")({ component: EmployeesPage });

const TYPES = ["full_time", "part_time", "contract", "intern"];

function EmployeesPage() {
  const { employees, departments, departmentName, saveEmployee, setEmployeeStatus, removeEmployee } = useHr();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrEmployee | null>(null);
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HrEmployee | null>(null);

  const monthStart = new Date().toISOString().slice(0, 7);
  const active = employees.filter((row) => row.status === "active").length;
  const inactive = employees.length - active;
  const joinedThisMonth = employees.filter((row) => row.joinedOn?.startsWith(monthStart)).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: HrEmployee) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const departmentId = departments.find((row) => row.name === str(value.department))?.id ?? null;
    saveEmployee(
      {
        code: str(value.code) || `EMP-${String(employees.length + 1).padStart(4, "0")}`,
        name: str(value.name),
        photoUrl: str(value.photoUrl) || undefined,
        phone: str(value.phone) || undefined,
        departmentId,
        position: str(value.position),
        employmentType: str(value.employmentType) as EmploymentType,
        status: str(value.status) as EmployeeStatus,
        joinedOn: str(value.joinedOn) || today(),
        basicSalary: num(value.basicSalary),
        allowances: num(value.allowances),
        deductions: num(value.deductions),
      },
      editing?.id,
    );
    toast.success(editing ? "Employee updated" : "Employee added");
  };

  return (
    <TaxWorkspace
      title="Employees"
      subtitle="Staff register feeding attendance, payroll and HR reports"
      icon={Users}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New employee
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Total Employees", value: String(employees.length), hint: `${departments.length} departments`, accent: true },
          { label: "Active Employees", value: String(active), tone: "success" },
          { label: "Inactive Employees", value: String(inactive), tone: inactive > 0 ? "warning" : "default" },
          { label: "New This Month", value: String(joinedThisMonth) },
        ]}
      />

      <TaxTable
        rows={employees}
        searchKeys={(row) => `${row.code} ${row.name} ${row.position} ${departmentName(row.departmentId)}`}
        filter={{
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            ...TYPES.map((type) => ({ value: type, label: employmentLabel(type) })),
            ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
          ],
          match: (row, value) => row.status === value || row.employmentType === value || row.departmentId === value,
        }}
        columns={[
          { key: "code", label: "Employee ID" },
          {
            key: "name",
            label: "Full Name",
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold text-white/80">
                  {row.photoUrl
                    ? <img src={row.photoUrl} alt={row.name} className="h-full w-full object-cover" />
                    : row.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                </span>
                <span className="font-medium text-white">{row.name}</span>
              </div>
            ),
          },
          { key: "department", label: "Department", hideOnMobile: true, render: (row) => departmentName(row.departmentId) },
          { key: "position", label: "Position", hideOnMobile: true, render: (row) => row.position || "—" },
          { key: "employmentType", label: "Employment", hideOnMobile: true, render: (row) => employmentLabel(row.employmentType) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status === "active" ? "Active" : "Inactive"} /> },
          { key: "joinedOn", label: "Date Joined", hideOnMobile: true, render: (row) => row.joinedOn || "—" },
        ]}
        onRowClick={(row) => setDetail(row)}
        onEdit={openEdit}
        onDelete={(row) => setPendingDelete(row)}
        rowActions={(row) => [
          { label: "View", onSelect: () => setDetail(row) },
          row.status === "active"
            ? { label: "Deactivate", onSelect: () => { setEmployeeStatus(row.id, "inactive"); toast.success(`${row.name} deactivated`); } }
            : { label: "Activate", onSelect: () => { setEmployeeStatus(row.id, "active"); toast.success(`${row.name} activated`); } },
        ]}
        onExport={(rows) =>
          exportCsv(
            "employees.csv",
            ["Employee ID", "Name", "Department", "Position", "Employment", "Status", "Joined", "Basic Salary"],
            rows.map((row) => [row.code, row.name, departmentName(row.departmentId), row.position, employmentLabel(row.employmentType), row.status, row.joinedOn, row.basicSalary]),
          )
        }
        addLabel="New employee"
        onAdd={openCreate}
        empty={{ title: "No employees yet", description: "Add your first staff member to start tracking attendance and payroll.", icon: Users }}
      />

      <RecordDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit employee" : "New employee"}
        description="Employee details are shared with attendance, payroll and reports."
        icon={Users}
        submitLabel={editing ? "Save changes" : "Add employee"}
        initialValue={
          editing
            ? {
                code: editing.code,
                name: editing.name,
                photoUrl: editing.photoUrl ?? "",
                phone: editing.phone ?? "",
                department: departmentName(editing.departmentId),
                position: editing.position,
                employmentType: editing.employmentType,
                status: editing.status,
                joinedOn: editing.joinedOn,
                basicSalary: editing.basicSalary,
                allowances: editing.allowances,
                deductions: editing.deductions,
              }
            : null
        }
        fields={[
          { name: "name", label: "Full name", type: "text", required: true },
          { name: "code", label: "Employee ID", type: "text", half: true },
          { name: "position", label: "Position", type: "text", half: true },
          { name: "department", label: "Department", type: "select", options: departments.map((row) => row.name), half: true },
          { name: "employmentType", label: "Employment type", type: "select", options: TYPES, half: true },
          { name: "status", label: "Status", type: "select", options: ["active", "inactive"], half: true },
          { name: "joinedOn", label: "Date joined", type: "date", half: true, defaultValue: today() },
          { name: "basicSalary", label: "Basic salary", type: "number", half: true },
          { name: "allowances", label: "Allowances", type: "number", half: true },
          { name: "deductions", label: "Deductions", type: "number", half: true },
          { name: "phone", label: "Phone", type: "text", half: true },
          { name: "photoUrl", label: "Photo URL", type: "text" },
        ]}
        onSubmit={submit}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description={detail ? `${detail.code} · ${departmentName(detail.departmentId)}` : undefined}
        icon={Users}
        rows={
          detail
            ? [
                { label: "Position", value: detail.position || "—" },
                { label: "Employment", value: employmentLabel(detail.employmentType) },
                { label: "Status", value: <StatusBadge value={detail.status === "active" ? "Active" : "Inactive"} /> },
                { label: "Date joined", value: detail.joinedOn || "—" },
                { label: "Basic salary", value: money(detail.basicSalary) },
                { label: "Allowances", value: money(detail.allowances) },
                { label: "Deductions", value: money(detail.deductions) },
                { label: "Net (before absence)", value: money(detail.basicSalary + detail.allowances - detail.deductions) },
                { label: "Phone", value: detail.phone ?? "—" },
              ]
            : []
        }
        footer={
          detail ? (
            <Button className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => { openEdit(detail); setDetail(null); }}>
              Edit employee
            </Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove employee"
        description={`${pendingDelete?.name ?? ""} will be removed from the HR register.`}
        onConfirm={() => { if (pendingDelete) { removeEmployee(pendingDelete.id); toast.success("Employee removed"); } }}
      />
    </TaxWorkspace>
  );
}
