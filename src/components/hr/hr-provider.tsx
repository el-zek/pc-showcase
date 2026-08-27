import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* ---------------------------------- types --------------------------------- */

export type EmployeeStatus = "active" | "inactive";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export type HrEmployee = {
  id: string;
  code: string;
  name: string;
  photoUrl?: string;
  phone?: string;
  departmentId: string | null;
  position: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  joinedOn: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
};

export type HrDepartment = {
  id: string;
  name: string;
  code?: string;
  managerId: string | null;
  budget: number;
  status: "active" | "inactive";
  description?: string;
};

export type AttendanceStatus = "present" | "absent" | "late" | "on_leave";
export type HrAttendance = {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  status: AttendanceStatus;
};

export type LeaveStatus = "pending" | "approved" | "rejected";
export type HrLeave = {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason?: string;
};

export type HrVacancy = {
  id: string;
  position: string;
  departmentId: string | null;
  employmentType: EmploymentType;
  openings: number;
  status: "open" | "on_hold" | "closed";
  postedOn: string;
};

export type ApplicantStatus = "pending" | "interview" | "accepted" | "rejected";
export type HrApplicant = {
  id: string;
  vacancyId: string | null;
  name: string;
  phone?: string;
  appliedOn: string;
  status: ApplicantStatus;
};

export type HrReview = {
  id: string;
  employeeId: string;
  period: string;
  kpiScore: number;
  rating: string;
  reviewer: string;
  reviewDate: string;
  status: "pending" | "completed";
};

export type ContractStatus = "active" | "expiring_soon" | "expired" | "terminated";
export type HrContract = {
  id: string;
  employeeId: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  status: "active" | "terminated";
};

export type PayrollItem = {
  id: string;
  period: string;
  employeeId: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  leaveDays: number;
  absentDays: number;
  netSalary: number;
  paymentStatus: "pending" | "paid";
  payslipNumber?: string;
  paidAt?: string;
};

type HrState = {
  departments: HrDepartment[];
  employees: HrEmployee[];
  attendance: HrAttendance[];
  leave: HrLeave[];
  vacancies: HrVacancy[];
  applicants: HrApplicant[];
  reviews: HrReview[];
  contracts: HrContract[];
  payroll: PayrollItem[];
};

/* --------------------------------- helpers -------------------------------- */

const STORAGE_KEY = "bizz.hr.v1";
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);
export const today = () => new Date().toISOString().slice(0, 10);
export const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const periodLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

export const employmentLabel = (value: string) =>
  ({ full_time: "Full time", part_time: "Part time", contract: "Contract", intern: "Intern" })[value] ?? value;

export const daysBetween = (start: string, end: string) => {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
};

export const contractStatus = (contract: HrContract): ContractStatus => {
  if (contract.status === "terminated") return "terminated";
  if (!contract.endDate) return "active";
  const end = new Date(contract.endDate).getTime();
  const now = Date.now();
  if (end < now) return "expired";
  if (end - now <= 30 * 86_400_000) return "expiring_soon";
  return "active";
};

export const contractStatusLabel = (status: ContractStatus) =>
  ({ active: "Active", expiring_soon: "Expiring Soon", expired: "Expired", terminated: "Terminated" })[status];

/* ---------------------------------- seed ---------------------------------- */

function seed(): HrState {
  const finance: HrDepartment = { id: uid(), name: "Finance", code: "FIN", managerId: null, budget: 24_000_000, status: "active" };
  const sales: HrDepartment = { id: uid(), name: "Sales", code: "SAL", managerId: null, budget: 36_000_000, status: "active" };
  const ops: HrDepartment = { id: uid(), name: "Operations", code: "OPS", managerId: null, budget: 18_000_000, status: "active" };
  const departments = [finance, sales, ops];

  const people: Array<[string, HrDepartment, string, EmploymentType, EmployeeStatus, string, number, number, number]> = [
    ["Amina Hassan", finance, "Finance Manager", "full_time", "active", "2023-02-14", 2_400_000, 300_000, 120_000],
    ["Joseph Mwita", sales, "Sales Executive", "full_time", "active", "2024-06-03", 1_200_000, 250_000, 60_000],
    ["Neema Kileo", sales, "Sales Executive", "part_time", "active", "2025-11-18", 700_000, 100_000, 35_000],
    ["Baraka Juma", ops, "Warehouse Supervisor", "full_time", "active", "2022-09-01", 1_500_000, 180_000, 75_000],
    ["Zawadi Msigwa", ops, "Store Clerk", "contract", "inactive", "2024-01-22", 850_000, 60_000, 40_000],
  ];

  const employees: HrEmployee[] = people.map(([name, dept, position, employmentType, status, joinedOn, basic, allow, ded], index) => ({
    id: uid(),
    code: `EMP-${String(index + 1).padStart(4, "0")}`,
    name,
    departmentId: dept.id,
    position,
    employmentType,
    status,
    joinedOn,
    basicSalary: basic,
    allowances: allow,
    deductions: ded,
    phone: "+255 7xx xxx xxx",
  }));

  finance.managerId = employees[0].id;
  sales.managerId = employees[1].id;
  ops.managerId = employees[3].id;

  const day = today();
  const attendance: HrAttendance[] = employees.slice(0, 4).map((employee, index) => ({
    id: uid(),
    employeeId: employee.id,
    date: day,
    checkIn: index === 2 ? "09:42" : "08:02",
    checkOut: "17:05",
    hours: index === 2 ? 7.4 : 9,
    status: index === 2 ? "late" : "present",
  }));

  const leave: HrLeave[] = [
    { id: uid(), employeeId: employees[1].id, leaveType: "annual", startDate: day, endDate: day, days: 1, status: "pending", reason: "Family event" },
    { id: uid(), employeeId: employees[3].id, leaveType: "sick", startDate: day, endDate: day, days: 1, status: "approved" },
  ];

  const vacancy: HrVacancy = { id: uid(), position: "Accountant", departmentId: finance.id, employmentType: "full_time", openings: 1, status: "open", postedOn: day };
  const applicants: HrApplicant[] = [
    { id: uid(), vacancyId: vacancy.id, name: "Grace Mollel", appliedOn: day, status: "interview" },
    { id: uid(), vacancyId: vacancy.id, name: "Salim Ally", appliedOn: day, status: "pending" },
  ];

  const reviews: HrReview[] = employees.slice(0, 3).map((employee, index) => ({
    id: uid(),
    employeeId: employee.id,
    period: currentPeriod(),
    kpiScore: [88, 74, 61][index],
    rating: ["Excellent", "Good", "Average"][index],
    reviewer: "Amina Hassan",
    reviewDate: day,
    status: index === 2 ? "pending" : "completed",
  }));

  const contracts: HrContract[] = employees.map((employee, index) => ({
    id: uid(),
    employeeId: employee.id,
    contractType: employee.employmentType === "contract" ? "fixed_term" : "permanent",
    startDate: employee.joinedOn,
    endDate: index === 4 ? "2026-07-31" : index === 2 ? "2026-08-25" : null,
    status: "active",
  }));

  return { departments, employees, attendance, leave, vacancies: [vacancy], applicants, reviews, contracts, payroll: [] };
}

/* -------------------------------- context --------------------------------- */

type HrContextValue = HrState & {
  departmentName: (id: string | null) => string;
  employeeName: (id: string) => string;
  employee: (id: string) => HrEmployee | undefined;

  saveEmployee: (value: Omit<HrEmployee, "id">, id?: string) => void;
  setEmployeeStatus: (id: string, status: EmployeeStatus) => void;
  removeEmployee: (id: string) => void;

  saveDepartment: (value: Omit<HrDepartment, "id">, id?: string) => void;
  removeDepartment: (id: string) => void;

  saveAttendance: (value: Omit<HrAttendance, "id">, id?: string) => void;
  removeAttendance: (id: string) => void;

  saveLeave: (value: Omit<HrLeave, "id">, id?: string) => void;
  setLeaveStatus: (id: string, status: LeaveStatus) => void;
  removeLeave: (id: string) => void;

  saveVacancy: (value: Omit<HrVacancy, "id">, id?: string) => void;
  removeVacancy: (id: string) => void;
  saveApplicant: (value: Omit<HrApplicant, "id">, id?: string) => void;
  setApplicantStatus: (id: string, status: ApplicantStatus) => void;
  removeApplicant: (id: string) => void;

  saveReview: (value: Omit<HrReview, "id">, id?: string) => void;
  removeReview: (id: string) => void;

  saveContract: (value: Omit<HrContract, "id">, id?: string) => void;
  renewContract: (id: string, endDate: string) => void;
  removeContract: (id: string) => void;

  payrollFor: (period: string) => PayrollItem[];
  generatePayroll: (period: string) => number;
  markPayrollPaid: (id: string) => void;
  generatePayslip: (id: string) => void;
};

const HrContext = createContext<HrContextValue | null>(null);

export function HrProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HrState>(() => seed());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState((current) => ({ ...current, ...(JSON.parse(raw) as HrState) }));
    } catch {
      /* ignore corrupt cache */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state, hydrated]);

  const patch = useCallback((next: Partial<HrState>) => setState((current) => ({ ...current, ...next })), []);

  const upsert = useCallback(
    <T extends { id: string }>(list: T[], value: Omit<T, "id">, id?: string): T[] =>
      id ? list.map((row) => (row.id === id ? ({ ...row, ...value, id } as T) : row)) : [...list, { ...(value as T), id: uid() }],
    [],
  );

  const value = useMemo<HrContextValue>(() => {
    const departmentName = (id: string | null) => state.departments.find((row) => row.id === id)?.name ?? "—";
    const employee = (id: string) => state.employees.find((row) => row.id === id);
    const employeeName = (id: string) => employee(id)?.name ?? "—";

    const buildPayroll = (period: string): PayrollItem[] => {
      const [year, month] = period.split("-");
      const inPeriod = (date: string) => date.startsWith(`${year}-${month}`);
      return state.employees
        .filter((row) => row.status === "active")
        .map((row) => {
          const records = state.attendance.filter((a) => a.employeeId === row.id && inPeriod(a.date));
          const absentDays = records.filter((a) => a.status === "absent").length;
          const leaveDays = state.leave
            .filter((l) => l.employeeId === row.id && l.status === "approved" && inPeriod(l.startDate))
            .reduce((sum, l) => sum + l.days, 0);
          const dailyRate = row.basicSalary / 22;
          const absenceDeduction = Math.round(dailyRate * absentDays);
          const deductions = row.deductions + absenceDeduction;
          return {
            id: uid(),
            period,
            employeeId: row.id,
            basicSalary: row.basicSalary,
            allowances: row.allowances,
            deductions,
            leaveDays,
            absentDays,
            netSalary: Math.max(0, row.basicSalary + row.allowances - deductions),
            paymentStatus: "pending" as const,
          };
        });
    };

    return {
      ...state,
      departmentName,
      employeeName,
      employee,

      saveEmployee: (v, id) => patch({ employees: upsert(state.employees, v, id) }),
      setEmployeeStatus: (id, status) =>
        patch({ employees: state.employees.map((row) => (row.id === id ? { ...row, status } : row)) }),
      removeEmployee: (id) => patch({ employees: state.employees.filter((row) => row.id !== id) }),

      saveDepartment: (v, id) => patch({ departments: upsert(state.departments, v, id) }),
      removeDepartment: (id) => patch({ departments: state.departments.filter((row) => row.id !== id) }),

      saveAttendance: (v, id) => patch({ attendance: upsert(state.attendance, v, id) }),
      removeAttendance: (id) => patch({ attendance: state.attendance.filter((row) => row.id !== id) }),

      saveLeave: (v, id) => patch({ leave: upsert(state.leave, v, id) }),
      setLeaveStatus: (id, status) => {
        const request = state.leave.find((row) => row.id === id);
        const leave = state.leave.map((row) => (row.id === id ? { ...row, status } : row));
        if (!request || status !== "approved") {
          patch({ leave });
          return;
        }
        // Approving leave writes the leave days straight into Attendance.
        const marks: HrAttendance[] = [];
        const cursor = new Date(request.startDate);
        const end = new Date(request.endDate);
        while (cursor <= end) {
          const date = cursor.toISOString().slice(0, 10);
          if (!state.attendance.some((a) => a.employeeId === request.employeeId && a.date === date)) {
            marks.push({ id: uid(), employeeId: request.employeeId, date, checkIn: "", checkOut: "", hours: 0, status: "on_leave" });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
        patch({
          leave,
          attendance: [
            ...state.attendance.map((a) =>
              a.employeeId === request.employeeId && a.date >= request.startDate && a.date <= request.endDate
                ? { ...a, status: "on_leave" as AttendanceStatus, hours: 0 }
                : a,
            ),
            ...marks,
          ],
        });
      },
      removeLeave: (id) => patch({ leave: state.leave.filter((row) => row.id !== id) }),

      saveVacancy: (v, id) => patch({ vacancies: upsert(state.vacancies, v, id) }),
      removeVacancy: (id) => patch({ vacancies: state.vacancies.filter((row) => row.id !== id) }),
      saveApplicant: (v, id) => patch({ applicants: upsert(state.applicants, v, id) }),
      setApplicantStatus: (id, status) =>
        patch({ applicants: state.applicants.map((row) => (row.id === id ? { ...row, status } : row)) }),
      removeApplicant: (id) => patch({ applicants: state.applicants.filter((row) => row.id !== id) }),

      saveReview: (v, id) => patch({ reviews: upsert(state.reviews, v, id) }),
      removeReview: (id) => patch({ reviews: state.reviews.filter((row) => row.id !== id) }),

      saveContract: (v, id) => patch({ contracts: upsert(state.contracts, v, id) }),
      renewContract: (id, endDate) =>
        patch({
          contracts: state.contracts.map((row) => (row.id === id ? { ...row, endDate, status: "active" } : row)),
        }),
      removeContract: (id) => patch({ contracts: state.contracts.filter((row) => row.id !== id) }),

      payrollFor: (period) => state.payroll.filter((row) => row.period === period),
      generatePayroll: (period) => {
        const existing = state.payroll.filter((row) => row.period === period);
        const fresh = buildPayroll(period).map((row) => {
          const prior = existing.find((old) => old.employeeId === row.employeeId);
          return prior ? { ...row, id: prior.id, paymentStatus: prior.paymentStatus, paidAt: prior.paidAt, payslipNumber: prior.payslipNumber } : row;
        });
        patch({ payroll: [...state.payroll.filter((row) => row.period !== period), ...fresh] });
        return fresh.length;
      },
      markPayrollPaid: (id) =>
        patch({
          payroll: state.payroll.map((row) =>
            row.id === id ? { ...row, paymentStatus: "paid", paidAt: new Date().toISOString() } : row,
          ),
        }),
      generatePayslip: (id) =>
        patch({
          payroll: state.payroll.map((row) =>
            row.id === id && !row.payslipNumber
              ? { ...row, payslipNumber: `PS-${row.period.replace("-", "")}-${row.id.slice(0, 4).toUpperCase()}` }
              : row,
          ),
        }),
    };
  }, [state, patch, upsert]);

  return <HrContext.Provider value={value}>{children}</HrContext.Provider>;
}

export function useHr() {
  const context = useContext(HrContext);
  if (!context) throw new Error("useHr must be used inside HrProvider");
  return context;
}
