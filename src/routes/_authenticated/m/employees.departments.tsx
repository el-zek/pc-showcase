import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useHr, type HrDepartment } from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/departments")({ component: DepartmentsPage });

function DepartmentsPage() {
  const { departments, employees, employeeName, saveDepartment, removeDepartment } = useHr();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrDepartment | null>(null);
  const [detail, setDetail] = useState<HrDepartment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HrDepartment | null>(null);

  const staffCount = (id: string) => employees.filter((row) => row.departmentId === id).length;
  const activeCount = departments.filter((row) => row.status === "active").length;
  const heads = departments.filter((row) => row.managerId).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: HrDepartment) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const managerId = employees.find((row) => row.name === str(value.manager))?.id ?? null;
    saveDepartment(
      {
        name: str(value.name),
        code: str(value.code) || undefined,
        managerId,
        budget: num(value.budget),
        status: str(value.status) as HrDepartment["status"],
        description: str(value.description) || undefined,
      },
      editing?.id,
    );
    toast.success(editing ? "Department updated" : "Department created");
  };

  return (
    <TaxWorkspace
      title="Departments"
      subtitle="Structure, managers and headcount across the business"
      icon={Building2}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New department
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Total Departments", value: String(departments.length), accent: true },
          { label: "Active Departments", value: String(activeCount), tone: "success" },
          { label: "Department Heads", value: String(heads) },
          { label: "Total Staff", value: String(employees.length) },
        ]}
      />

      <TaxTable
        rows={departments}
        searchKeys={(row) => `${row.name} ${row.code ?? ""} ${employeeName(row.managerId ?? "")}`}
        filter={{
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "name", label: "Department", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "manager", label: "Manager", render: (row) => (row.managerId ? employeeName(row.managerId) : "—") },
          { key: "staff", label: "Employees", hideOnMobile: true, render: (row) => String(staffCount(row.id)) },
          { key: "budget", label: "Budget", hideOnMobile: true, render: (row) => money(row.budget) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status === "active" ? "Active" : "Inactive"} /> },
        ]}
        onRowClick={(row) => setDetail(row)}
        onEdit={openEdit}
        onDelete={(row) => setPendingDelete(row)}
        rowActions={(row) => [{ label: "View", onSelect: () => setDetail(row) }]}
        onExport={(rows) =>
          exportCsv(
            "departments.csv",
            ["Department", "Manager", "Employees", "Budget", "Status"],
            rows.map((row) => [row.name, row.managerId ? employeeName(row.managerId) : "", staffCount(row.id), row.budget, row.status]),
          )
        }
        addLabel="New department"
        onAdd={openCreate}
        empty={{ title: "No departments yet", description: "Create departments to group employees, payroll and reports.", icon: Building2 }}
      />

      <RecordDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit department" : "New department"}
        description="Departments are used across employees, payroll and HR reports."
        icon={Building2}
        submitLabel={editing ? "Save changes" : "Create department"}
        initialValue={
          editing
            ? {
                name: editing.name,
                code: editing.code ?? "",
                manager: editing.managerId ? employeeName(editing.managerId) : "",
                budget: editing.budget,
                status: editing.status,
                description: editing.description ?? "",
              }
            : null
        }
        fields={[
          { name: "name", label: "Department name", type: "text", required: true },
          { name: "code", label: "Code", type: "text", half: true },
          { name: "manager", label: "Manager", type: "select", options: ["", ...employees.map((row) => row.name)], half: true },
          { name: "budget", label: "Budget", type: "number", half: true },
          { name: "status", label: "Status", type: "select", options: ["active", "inactive"], half: true },
          { name: "description", label: "Description", type: "text" },
        ]}
        onSubmit={submit}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description={detail?.code ? `Code ${detail.code}` : undefined}
        icon={Building2}
        rows={
          detail
            ? [
                { label: "Manager", value: detail.managerId ? employeeName(detail.managerId) : "—" },
                { label: "Employees", value: String(staffCount(detail.id)) },
                { label: "Budget", value: money(detail.budget) },
                { label: "Status", value: <StatusBadge value={detail.status === "active" ? "Active" : "Inactive"} /> },
                { label: "Description", value: detail.description ?? "—" },
              ]
            : []
        }
        footer={
          detail ? (
            <Button className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => { openEdit(detail); setDetail(null); }}>
              Edit department
            </Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove department"
        description={`${pendingDelete?.name ?? ""} will be removed. Employees keep their records but lose this department.`}
        onConfirm={() => { if (pendingDelete) { removeDepartment(pendingDelete.id); toast.success("Department removed"); } }}
      />
    </TaxWorkspace>
  );
}
