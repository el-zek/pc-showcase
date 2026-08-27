import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useHr, employmentLabel, today,
  type ApplicantStatus, type EmploymentType, type HrApplicant, type HrVacancy,
} from "@/components/hr/hr-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/employees/recruitment")({ component: RecruitmentPage });

const TYPES = ["full_time", "part_time", "contract", "intern"];

function RecruitmentPage() {
  const {
    vacancies, applicants, departments, departmentName,
    saveVacancy, removeVacancy, saveApplicant, setApplicantStatus, removeApplicant,
  } = useHr();

  const [vacancyForm, setVacancyForm] = useState(false);
  const [vacancyEditing, setVacancyEditing] = useState<HrVacancy | null>(null);
  const [vacancyDelete, setVacancyDelete] = useState<HrVacancy | null>(null);

  const [applicantForm, setApplicantForm] = useState(false);
  const [applicantEditing, setApplicantEditing] = useState<HrApplicant | null>(null);
  const [applicantDelete, setApplicantDelete] = useState<HrApplicant | null>(null);

  const openVacancies = vacancies.filter((row) => row.status === "open").length;
  const interviews = applicants.filter((row) => row.status === "interview").length;
  const hired = applicants.filter((row) => row.status === "accepted").length;
  const applicantsFor = (vacancyId: string) => applicants.filter((row) => row.vacancyId === vacancyId).length;
  const positionFor = (vacancyId: string | null) => vacancies.find((row) => row.id === vacancyId)?.position ?? "—";

  const submitVacancy = (value: Record<string, FieldValue>) => {
    saveVacancy(
      {
        position: str(value.position),
        departmentId: departments.find((row) => row.name === str(value.department))?.id ?? null,
        employmentType: str(value.employmentType) as EmploymentType,
        openings: num(value.openings) || 1,
        status: str(value.status) as HrVacancy["status"],
        postedOn: str(value.postedOn) || today(),
      },
      vacancyEditing?.id,
    );
    toast.success(vacancyEditing ? "Vacancy updated" : "Vacancy posted");
  };

  const submitApplicant = (value: Record<string, FieldValue>) => {
    saveApplicant(
      {
        vacancyId: vacancies.find((row) => row.position === str(value.vacancy))?.id ?? null,
        name: str(value.name),
        phone: str(value.phone) || undefined,
        appliedOn: str(value.appliedOn) || today(),
        status: str(value.status) as ApplicantStatus,
      },
      applicantEditing?.id,
    );
    toast.success(applicantEditing ? "Applicant updated" : "Applicant added");
  };

  return (
    <TaxWorkspace
      title="Recruitment"
      subtitle="Vacancies, applicants and hiring pipeline"
      icon={UserPlus}
      backTo="/m/employees"
      backLabel="Back to Employees"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={() => { setVacancyEditing(null); setVacancyForm(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> New vacancy
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Active Vacancies", value: String(openVacancies), accent: true },
          { label: "Applications", value: String(applicants.length) },
          { label: "Interviews", value: String(interviews), tone: "warning" },
          { label: "Hired Employees", value: String(hired), tone: "success" },
        ]}
      />

      <TaxTable
        rows={vacancies}
        searchKeys={(row) => `${row.position} ${departmentName(row.departmentId)} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "open", label: "Open" },
            { value: "on_hold", label: "On hold" },
            { value: "closed", label: "Closed" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "position", label: "Position", render: (row) => <span className="font-medium text-white">{row.position}</span> },
          { key: "department", label: "Department", hideOnMobile: true, render: (row) => departmentName(row.departmentId) },
          { key: "employmentType", label: "Employment", hideOnMobile: true, render: (row) => employmentLabel(row.employmentType) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status === "open" ? "Active" : row.status === "closed" ? "Cancelled" : "Pending"} /> },
          { key: "applicants", label: "Applicants", render: (row) => String(applicantsFor(row.id)) },
        ]}
        onEdit={(row) => { setVacancyEditing(row); setVacancyForm(true); }}
        onDelete={(row) => setVacancyDelete(row)}
        onExport={(rows) =>
          exportCsv(
            "vacancies.csv",
            ["Position", "Department", "Employment", "Status", "Applicants"],
            rows.map((row) => [row.position, departmentName(row.departmentId), employmentLabel(row.employmentType), row.status, applicantsFor(row.id)]),
          )
        }
        addLabel="New vacancy"
        onAdd={() => { setVacancyEditing(null); setVacancyForm(true); }}
        empty={{ title: "No vacancies", description: "Post a vacancy to start collecting applications.", icon: UserPlus }}
      />

      <TaxTable
        rows={applicants}
        searchKeys={(row) => `${row.name} ${positionFor(row.vacancyId)} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "pending", label: "Pending" },
            { value: "interview", label: "Interview" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "name", label: "Applicant", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "position", label: "Position", render: (row) => positionFor(row.vacancyId) },
          { key: "appliedOn", label: "Applied Date", hideOnMobile: true },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <StatusBadge value={row.status === "accepted" ? "Approved" : row.status === "interview" ? "Review" : row.status === "rejected" ? "Cancelled" : "Pending"} />
            ),
          },
        ]}
        onEdit={(row) => { setApplicantEditing(row); setApplicantForm(true); }}
        onDelete={(row) => setApplicantDelete(row)}
        rowActions={(row) => [
          { label: "Move to interview", onSelect: () => { setApplicantStatus(row.id, "interview"); toast.success("Moved to interview"); } },
          { label: "Accept", onSelect: () => { setApplicantStatus(row.id, "accepted"); toast.success("Applicant accepted"); } },
          { label: "Reject", onSelect: () => { setApplicantStatus(row.id, "rejected"); toast.success("Applicant rejected"); }, danger: true },
        ]}
        onExport={(rows) =>
          exportCsv(
            "applicants.csv",
            ["Applicant", "Position", "Applied", "Status"],
            rows.map((row) => [row.name, positionFor(row.vacancyId), row.appliedOn, row.status]),
          )
        }
        addLabel="New applicant"
        onAdd={() => { setApplicantEditing(null); setApplicantForm(true); }}
        empty={{ title: "No applicants", description: "Applicants added here move through the hiring pipeline.", icon: UserPlus }}
      />

      <RecordDialog
        open={vacancyForm}
        onClose={() => setVacancyForm(false)}
        title={vacancyEditing ? "Edit vacancy" : "New vacancy"}
        icon={UserPlus}
        submitLabel={vacancyEditing ? "Save changes" : "Post vacancy"}
        initialValue={
          vacancyEditing
            ? {
                position: vacancyEditing.position,
                department: departmentName(vacancyEditing.departmentId),
                employmentType: vacancyEditing.employmentType,
                openings: vacancyEditing.openings,
                status: vacancyEditing.status,
                postedOn: vacancyEditing.postedOn,
              }
            : null
        }
        fields={[
          { name: "position", label: "Position", type: "text", required: true },
          { name: "department", label: "Department", type: "select", options: departments.map((row) => row.name), half: true },
          { name: "employmentType", label: "Employment type", type: "select", options: TYPES, half: true },
          { name: "openings", label: "Openings", type: "number", half: true, defaultValue: 1 },
          { name: "status", label: "Status", type: "select", options: ["open", "on_hold", "closed"], half: true },
          { name: "postedOn", label: "Posted on", type: "date", half: true, defaultValue: today() },
        ]}
        onSubmit={submitVacancy}
      />

      <RecordDialog
        open={applicantForm}
        onClose={() => setApplicantForm(false)}
        title={applicantEditing ? "Edit applicant" : "New applicant"}
        icon={UserPlus}
        submitLabel={applicantEditing ? "Save changes" : "Add applicant"}
        initialValue={
          applicantEditing
            ? {
                name: applicantEditing.name,
                vacancy: positionFor(applicantEditing.vacancyId),
                phone: applicantEditing.phone ?? "",
                appliedOn: applicantEditing.appliedOn,
                status: applicantEditing.status,
              }
            : null
        }
        fields={[
          { name: "name", label: "Applicant name", type: "text", required: true },
          { name: "vacancy", label: "Vacancy", type: "select", options: vacancies.map((row) => row.position), half: true },
          { name: "status", label: "Status", type: "select", options: ["pending", "interview", "accepted", "rejected"], half: true },
          { name: "appliedOn", label: "Applied on", type: "date", half: true, defaultValue: today() },
          { name: "phone", label: "Phone", type: "text", half: true },
        ]}
        onSubmit={submitApplicant}
      />

      <ConfirmDialog
        open={Boolean(vacancyDelete)}
        onClose={() => setVacancyDelete(null)}
        title="Remove vacancy"
        description="Applicants linked to this vacancy will lose their position reference."
        onConfirm={() => { if (vacancyDelete) { removeVacancy(vacancyDelete.id); toast.success("Vacancy removed"); } }}
      />

      <ConfirmDialog
        open={Boolean(applicantDelete)}
        onClose={() => setApplicantDelete(null)}
        title="Remove applicant"
        description={`${applicantDelete?.name ?? ""} will be removed from the pipeline.`}
        onConfirm={() => { if (applicantDelete) { removeApplicant(applicantDelete.id); toast.success("Applicant removed"); } }}
      />
    </TaxWorkspace>
  );
}
