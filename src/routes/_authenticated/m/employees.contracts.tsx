import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useHr, today, contractStatus, contractStatusLabel, type HrContract,
} from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/contracts")({ component: ContractsPage });

const contractTypes = ["permanent", "fixed_term", "probation", "internship"];
const typeLabel = (value: string) =>
  ({ permanent: "Permanent", fixed_term: "Fixed term", probation: "Probation", internship: "Internship" })[value] ?? value;

function ContractsPage() {
  const { contracts, employees, employeeName, employee, departmentName, saveContract, renewContract, removeContract } = useHr();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrContract | null>(null);
  const [renewing, setRenewing] = useState<HrContract | null>(null);
  const [detail, setDetail] = useState<HrContract | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HrContract | null>(null);

  const rows = useMemo(
    () => [...contracts].sort((a, b) => (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999")),
    [contracts],
  );

  const totals = useMemo(() => {
    const count = (status: string) => contracts.filter((row) => contractStatus(row) === status).length;
    return { active: count("active"), expiring: count("expiring_soon"), expired: count("expired") };
  }, [contracts]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const employeeId = employees.find((row) => row.name === str(value.employee))?.id;
    if (!employeeId) { toast.error("Select an employee"); return; }
    saveContract(
      {
        employeeId,
        contractType: str(value.contractType) || "permanent",
        startDate: str(value.startDate) || today(),
        endDate: str(value.endDate) || null,
        status: (str(value.status) as HrContract["status"]) || "active",
      },
      editing?.id,
    );
    toast.success(editing ? "Contract updated" : "Contract added");
  };

  return (
    <TaxWorkspace
      title="Contracts"
      subtitle="Employment agreements with expiry and renewal tracking"
      icon={ClipboardList}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Add contract
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Contracts", value: String(contracts.length) },
          { label: "Active", value: String(totals.active), tone: "success" },
          { label: "Expiring Soon", value: String(totals.expiring), hint: "Within 30 days", tone: totals.expiring > 0 ? "warning" : "default" },
          { label: "Expired", value: String(totals.expired), tone: totals.expired > 0 ? "danger" : "default" },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${employeeName(row.employeeId)} ${typeLabel(row.contractType)} ${contractStatusLabel(contractStatus(row))}`}
        filter={{
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "expiring_soon", label: "Expiring soon" },
            { value: "expired", label: "Expired" },
            { value: "terminated", label: "Terminated" },
          ],
          match: (row, value) => contractStatus(row) === value,
        }}
        columns={[
          { key: "employee", label: "Employee", render: (row) => <span className="font-medium text-white">{employeeName(row.employeeId)}</span> },
          { key: "contractType", label: "Type", render: (row) => typeLabel(row.contractType) },
          { key: "startDate", label: "Start", hideOnMobile: true },
          { key: "endDate", label: "End", hideOnMobile: true, render: (row) => row.endDate ?? "Open ended" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={contractStatusLabel(contractStatus(row))} /> },
        ]}
        onRowClick={(row) => setDetail(row)}
        rowActions={(row) => [
          { label: "View", onSelect: () => setDetail(row) },
          { label: "Edit", onSelect: () => { setEditing(row); setFormOpen(true); } },
          { label: "Renew", onSelect: () => setRenewing(row) },
          { label: "Delete", onSelect: () => setPendingDelete(row) },
        ]}
        onExport={(exported) =>
          exportCsv(
            "contracts.csv",
            ["Employee", "Department", "Type", "Start", "End", "Status"],
            exported.map((row) => [
              employeeName(row.employeeId),
              departmentName(employee(row.employeeId)?.departmentId ?? null),
              typeLabel(row.contractType),
              row.startDate,
              row.endDate ?? "",
              contractStatusLabel(contractStatus(row)),
            ]),
          )
        }
        addLabel="Add contract"
        onAdd={openCreate}
        empty={{ title: "No contracts recorded", description: "Add employment agreements to track expiry and renewals.", icon: ClipboardList }}
      />

      <RecordDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit contract" : "Add contract"}
        description="Expiring contracts appear in the HR attention list."
        icon={ClipboardList}
        submitLabel={editing ? "Save changes" : "Save contract"}
        initialValue={
          editing
            ? {
                employee: employeeName(editing.employeeId),
                contractType: editing.contractType,
                startDate: editing.startDate,
                endDate: editing.endDate ?? "",
                status: editing.status,
              }
            : { startDate: today() }
        }
        fields={[
          { name: "employee", label: "Employee", type: "select", options: employees.map((row) => row.name), required: true },
          { name: "contractType", label: "Contract type", type: "select", options: contractTypes, half: true },
          { name: "status", label: "Status", type: "select", options: ["active", "terminated"], half: true },
          { name: "startDate", label: "Start date", type: "date", half: true, defaultValue: today() },
          { name: "endDate", label: "End date", type: "date", half: true },
        ]}
        onSubmit={submit}
      />

      <RecordDialog
        open={Boolean(renewing)}
        onClose={() => setRenewing(null)}
        title="Renew contract"
        description="Set the new expiry date for this agreement."
        icon={ClipboardList}
        submitLabel="Renew"
        fields={[{ name: "endDate", label: "New end date", type: "date", required: true }]}
        onSubmit={(value) => {
          if (!renewing) return;
          const endDate = str(value.endDate);
          if (!endDate) { toast.error("Pick a new end date"); return; }
          renewContract(renewing.id, endDate);
          toast.success("Contract renewed");
        }}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? employeeName(detail.employeeId) : ""}
        description={detail ? typeLabel(detail.contractType) : undefined}
        icon={ClipboardList}
        rows={
          detail
            ? [
                { label: "Department", value: departmentName(employee(detail.employeeId)?.departmentId ?? null) },
                { label: "Contract type", value: typeLabel(detail.contractType) },
                { label: "Start date", value: detail.startDate },
                { label: "End date", value: detail.endDate ?? "Open ended" },
                { label: "Status", value: <StatusBadge value={contractStatusLabel(contractStatus(detail))} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <Button className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => { setRenewing(detail); setDetail(null); }}>
              Renew contract
            </Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove contract"
        description="The agreement record will be deleted."
        onConfirm={() => { if (pendingDelete) { removeContract(pendingDelete.id); toast.success("Contract removed"); } }}
      />
    </TaxWorkspace>
  );
}
