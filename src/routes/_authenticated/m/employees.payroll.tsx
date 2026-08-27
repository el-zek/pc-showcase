import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useHr, currentPeriod, periodLabel, type PayrollItem } from "@/components/hr/hr-provider";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/payroll")({ component: PayrollPage });

function PayrollPage() {
  const { payrollFor, generatePayroll, markPayrollPaid, generatePayslip, employeeName, employee, departmentName } = useHr();
  const [period, setPeriod] = useState(currentPeriod());
  const [detail, setDetail] = useState<PayrollItem | null>(null);

  const rows = payrollFor(period);
  const totals = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + row.netSalary, 0);
    const paid = rows.filter((row) => row.paymentStatus === "paid");
    return { total, paid: paid.length, pending: rows.length - paid.length };
  }, [rows]);

  return (
    <TaxWorkspace
      title="Payroll"
      subtitle="Calculated from employees, attendance and approved leave"
      icon={Banknote}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <>
          <input
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-9 rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white outline-none focus:border-amber-300/50"
          />
          <Button
            size="sm"
            className="h-9 bg-amber-400 text-black hover:bg-amber-300"
            onClick={() => {
              const count = generatePayroll(period);
              toast.success(`Payroll prepared for ${count} employees`);
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Run payroll
          </Button>
        </>
      }
    >
      <SummaryStrip
        items={[
          { label: "Payroll Month", value: periodLabel(period), accent: true },
          { label: "Total Payroll", value: money(totals.total), hint: `${rows.length} employees` },
          { label: "Paid Employees", value: String(totals.paid), tone: "success" },
          { label: "Pending Payments", value: String(totals.pending), tone: totals.pending > 0 ? "warning" : "default" },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${employeeName(row.employeeId)} ${row.paymentStatus}`}
        filter={{
          label: "Payment",
          options: [
            { value: "pending", label: "Pending" },
            { value: "paid", label: "Paid" },
          ],
          match: (row, value) => row.paymentStatus === value,
        }}
        columns={[
          { key: "employee", label: "Employee", render: (row) => <span className="font-medium text-white">{employeeName(row.employeeId)}</span> },
          { key: "basicSalary", label: "Basic Salary", render: (row) => money(row.basicSalary) },
          { key: "allowances", label: "Allowances", hideOnMobile: true, render: (row) => money(row.allowances) },
          { key: "deductions", label: "Deductions", hideOnMobile: true, render: (row) => money(row.deductions) },
          { key: "netSalary", label: "Net Salary", render: (row) => <span className="font-semibold text-white">{money(row.netSalary)}</span> },
          { key: "paymentStatus", label: "Payment", render: (row) => <StatusBadge value={row.paymentStatus === "paid" ? "Paid" : "Pending"} /> },
        ]}
        onRowClick={(row) => setDetail(row)}
        rowActions={(row) => [
          { label: "View", onSelect: () => setDetail(row) },
          { label: "Generate payslip", onSelect: () => { generatePayslip(row.id); toast.success("Payslip generated"); } },
          ...(row.paymentStatus === "pending"
            ? [{ label: "Mark as paid", onSelect: () => { markPayrollPaid(row.id); toast.success("Payment recorded"); } }]
            : []),
          { label: "Print", onSelect: () => window.print() },
        ]}
        onExport={(exported) =>
          exportCsv(
            `payroll-${period}.csv`,
            ["Employee", "Department", "Basic", "Allowances", "Deductions", "Net", "Status"],
            exported.map((row) => [
              employeeName(row.employeeId),
              departmentName(employee(row.employeeId)?.departmentId ?? null),
              row.basicSalary,
              row.allowances,
              row.deductions,
              row.netSalary,
              row.paymentStatus,
            ]),
          )
        }
        addLabel="Run payroll"
        onAdd={() => { const count = generatePayroll(period); toast.success(`Payroll prepared for ${count} employees`); }}
        empty={{ title: "No payroll for this month", description: "Run payroll to calculate salaries from employees, attendance and leave.", icon: Banknote }}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? employeeName(detail.employeeId) : ""}
        description={detail ? `Payroll · ${periodLabel(detail.period)}` : undefined}
        icon={Banknote}
        rows={
          detail
            ? [
                { label: "Department", value: departmentName(employee(detail.employeeId)?.departmentId ?? null) },
                { label: "Basic salary", value: money(detail.basicSalary) },
                { label: "Allowances", value: money(detail.allowances) },
                { label: "Deductions", value: money(detail.deductions) },
                { label: "Absent days", value: String(detail.absentDays) },
                { label: "Leave days", value: String(detail.leaveDays) },
                { label: "Net salary", value: money(detail.netSalary) },
                { label: "Payment", value: <StatusBadge value={detail.paymentStatus === "paid" ? "Paid" : "Pending"} /> },
                { label: "Payslip", value: detail.payslipNumber ?? "Not generated" },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
                onClick={() => { generatePayslip(detail.id); toast.success("Payslip generated"); }}
              >
                Generate payslip
              </Button>
              <Button className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => window.print()}>
                Print
              </Button>
            </>
          ) : null
        }
      />
    </TaxWorkspace>
  );
}
