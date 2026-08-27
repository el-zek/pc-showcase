import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileBarChart, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useHr, currentPeriod, periodLabel, type PayrollItem } from "@/components/hr/hr-provider";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/payslips")({ component: PayslipsPage });

function PayslipsPage() {
  const { payroll, payrollFor, generatePayslip, employeeName, employee, departmentName } = useHr();
  const [period, setPeriod] = useState(currentPeriod());
  const [detail, setDetail] = useState<PayrollItem | null>(null);

  const rows = useMemo(
    () => payrollFor(period).filter((row) => Boolean(row.payslipNumber)),
    [payrollFor, period],
  );

  const monthRows = payrollFor(period);
  const totals = useMemo(() => {
    const value = rows.reduce((sum, row) => sum + row.netSalary, 0);
    const paid = rows.filter((row) => row.paymentStatus === "paid").length;
    return { value, paid, pending: monthRows.length - rows.length };
  }, [rows, monthRows.length]);

  const generateAll = () => {
    const missing = monthRows.filter((row) => !row.payslipNumber);
    if (missing.length === 0) { toast.info("All payslips for this month are generated"); return; }
    missing.forEach((row) => generatePayslip(row.id));
    toast.success(`${missing.length} payslips generated`);
  };

  return (
    <TaxWorkspace
      title="Payslips"
      subtitle="Generated from payroll runs — one payslip per employee per month"
      icon={FileBarChart}
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
          <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={generateAll}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Generate payslips
          </Button>
        </>
      }
    >
      <SummaryStrip
        items={[
          { label: "Payslip Month", value: periodLabel(period), accent: true },
          { label: "Payslips Issued", value: String(rows.length), hint: `${monthRows.length} payroll rows` },
          { label: "Total Net Value", value: money(totals.value) },
          { label: "Not Generated", value: String(totals.pending), tone: totals.pending > 0 ? "warning" : "default" },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${employeeName(row.employeeId)} ${row.payslipNumber ?? ""} ${row.paymentStatus}`}
        filter={{
          label: "Payment",
          options: [
            { value: "pending", label: "Pending" },
            { value: "paid", label: "Paid" },
          ],
          match: (row, value) => row.paymentStatus === value,
        }}
        columns={[
          { key: "payslipNumber", label: "Payslip No.", render: (row) => <span className="font-medium text-white">{row.payslipNumber}</span> },
          { key: "employee", label: "Employee", render: (row) => employeeName(row.employeeId) },
          { key: "period", label: "Period", hideOnMobile: true, render: (row) => periodLabel(row.period) },
          { key: "deductions", label: "Deductions", hideOnMobile: true, render: (row) => money(row.deductions) },
          { key: "netSalary", label: "Net Pay", render: (row) => <span className="font-semibold text-white">{money(row.netSalary)}</span> },
          { key: "paymentStatus", label: "Payment", render: (row) => <StatusBadge value={row.paymentStatus === "paid" ? "Paid" : "Pending"} /> },
        ]}
        onRowClick={(row) => setDetail(row)}
        rowActions={(row) => [
          { label: "View", onSelect: () => setDetail(row) },
          { label: "Print", onSelect: () => window.print() },
        ]}
        onExport={(exported) =>
          exportCsv(
            `payslips-${period}.csv`,
            ["Payslip", "Employee", "Department", "Period", "Basic", "Allowances", "Deductions", "Net", "Status"],
            exported.map((row) => [
              row.payslipNumber ?? "",
              employeeName(row.employeeId),
              departmentName(employee(row.employeeId)?.departmentId ?? null),
              row.period,
              row.basicSalary,
              row.allowances,
              row.deductions,
              row.netSalary,
              row.paymentStatus,
            ]),
          )
        }
        addLabel="Generate payslips"
        onAdd={generateAll}
        empty={{
          title: payroll.length === 0 ? "No payroll data yet" : "No payslips for this month",
          description: "Run payroll first, then generate payslips for the selected month.",
          icon: FileBarChart,
        }}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? (detail.payslipNumber ?? "Payslip") : ""}
        description={detail ? `${employeeName(detail.employeeId)} · ${periodLabel(detail.period)}` : undefined}
        icon={FileBarChart}
        rows={
          detail
            ? [
                { label: "Employee", value: employeeName(detail.employeeId) },
                { label: "Department", value: departmentName(employee(detail.employeeId)?.departmentId ?? null) },
                { label: "Basic salary", value: money(detail.basicSalary) },
                { label: "Allowances", value: money(detail.allowances) },
                { label: "Deductions", value: money(detail.deductions) },
                { label: "Absent days", value: String(detail.absentDays) },
                { label: "Leave days", value: String(detail.leaveDays) },
                { label: "Net pay", value: money(detail.netSalary) },
                { label: "Payment", value: <StatusBadge value={detail.paymentStatus === "paid" ? "Paid" : "Pending"} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <Button className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => window.print()}>
              Print payslip
            </Button>
          ) : null
        }
      />
    </TaxWorkspace>
  );
}
