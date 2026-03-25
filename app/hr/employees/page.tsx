"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search,
  UserX, UserCheck, UserMinus, Camera, X, Loader2, Upload,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import {
  Drawer, DrawerFooter, ErrorBanner, SuccessBanner,
  AccessDeniedBanner, AuthStrip, FieldError, StatusActionButton,
} from "@/components/hr/Hrdrawer";
import { useAuth } from "@/hooks/useAuth";
import type { Employee, Department, EmploymentType, Currency, EmployeeStatus } from "@/types";
import { clsx } from "clsx";

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];
const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract",  label: "Contract"  },
  { value: "intern",    label: "Intern"    },
];

// ── Photo Upload Widget ────────────────────────────────────────────────────────
function PhotoUpload({ employeeId, currentUrl, name, onUploaded, readOnly }: {
  employeeId?: string;
  currentUrl?: string | null;
  name: string;
  onUploaded?: (url: string | null) => void;
  readOnly?: boolean;
}) {
  const [preview,   setPreview]   = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPreview(currentUrl || null); setError(""); }, [currentUrl]);

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024)    { setError("Image must be under 5 MB."); return; }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setError("");
    if (!employeeId) { onUploaded?.(localUrl); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res  = await fetch(`/api/hr/employees/${employeeId}/photo`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) { setPreview(data.data.photo_url); onUploaded?.(data.data.photo_url); }
      else { setError(data.message || "Upload failed."); setPreview(currentUrl || null); }
    } catch { setError("Network error during upload."); setPreview(currentUrl || null); }
    finally { setUploading(false); }
  };

  const handleRemove = async () => {
    if (!employeeId) { setPreview(null); onUploaded?.(null); return; }
    setUploading(true);
    try {
      await fetch(`/api/hr/employees/${employeeId}/photo`, { method: "DELETE" });
      setPreview(null); onUploaded?.(null);
    } catch { setError("Failed to remove photo."); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="relative flex-shrink-0">
        <div className={clsx(
          "w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center",
          preview ? "border-brand-300 bg-gray-100" : "border-dashed border-surface-400 bg-surface-100"
        )}>
          {preview
            ? <img src={preview} alt={name} className="w-full h-full object-cover" />
            : <span className="text-xl font-bold text-gray-400">{initials}</span>}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>
        {!readOnly && !uploading && (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center shadow-md transition-colors"
            title="Upload photo">
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-xs font-medium text-gray-700 mb-1">Profile Photo</p>
        <p className="text-xs text-gray-400 mb-2">JPEG, PNG or WebP · max 5 MB</p>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-gray-700 transition-colors disabled:opacity-50">
              <Upload className="w-3 h-3" />{preview ? "Change" : "Upload"}
            </button>
            {preview && (
              <button type="button" onClick={handleRemove} disabled={uploading}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                <X className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Employee avatar (table) ────────────────────────────────────────────────────
function EmployeeAvatar({ emp }: { emp: Employee }) {
  const initials = emp.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
      emp.status === "active" ? "bg-brand-100" : emp.status === "on_leave" ? "bg-amber-100" : "bg-gray-100")}>
      {(emp as any).photo_url
        ? <img src={(emp as any).photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
        : <span className={clsx("text-xs font-bold",
            emp.status === "active" ? "text-brand-700" : emp.status === "on_leave" ? "text-amber-700" : "text-gray-400"
          )}>{initials}</span>}
    </div>
  );
}

// ── Form ───────────────────────────────────────────────────────────────────────
interface FormFields {
  employee_code: string; full_name: string; email: string; phone: string;
  department_id: string; position: string; employment_type: EmploymentType;
  salary: string; currency: Currency; hire_date: string; manager_id: string;
}
interface FormErrors {
  employee_code?: string; full_name?: string; email?: string;
  department_id?: string; position?: string; salary?: string; hire_date?: string;
}
const today = () => new Date().toISOString().split("T")[0];
const EMPTY_FORM: FormFields = {
  employee_code: "", full_name: "", email: "", phone: "",
  department_id: "", position: "", employment_type: "full_time",
  salary: "", currency: "USD", hire_date: today(), manager_id: "",
};
function validateForm(f: FormFields, mode: "add"|"edit"): FormErrors {
  const e: FormErrors = {};
  if (mode === "add" && !f.employee_code.trim()) e.employee_code = "Required.";
  if (!f.full_name.trim()) e.full_name = "Full name is required.";
  if (!f.email.trim()) e.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email.";
  if (!f.department_id) e.department_id = "Department is required.";
  if (!f.position.trim()) e.position = "Position is required.";
  const sal = parseFloat(f.salary);
  if (!f.salary || isNaN(sal) || sal <= 0) e.salary = "Enter a valid salary.";
  if (!f.hire_date) e.hire_date = "Hire date is required.";
  return e;
}
function EmployeeFormFields({ fields, errors, set, departments, employees, mode, firstRef, readOnly }: {
  fields: FormFields; errors: FormErrors; set: (k: keyof FormFields, v: string) => void;
  departments: Department[]; employees: Employee[];
  mode: "add"|"edit"; firstRef?: React.Ref<HTMLInputElement>; readOnly?: boolean;
}) {
  const ro = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Code {mode==="add" && <span className="text-red-500">*</span>}</label>
          <input ref={firstRef} type="text" value={fields.employee_code} onChange={(e) => set("employee_code", e.target.value)}
            placeholder="EMP-0042" disabled={readOnly || mode==="edit"}
            className={clsx("input font-mono", errors.employee_code && "border-red-400", (readOnly||mode==="edit") && "opacity-60 cursor-not-allowed bg-surface-200")} />
          {mode==="edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Code cannot be changed.</p>}
          <FieldError message={errors.employee_code} />
        </div>
        <div>
          <label className="label">Employment Type</label>
          <select value={fields.employment_type} onChange={(e) => set("employment_type", e.target.value)} disabled={readOnly} className={ro()}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Full Name <span className="text-red-500">*</span></label>
        <input type="text" value={fields.full_name} onChange={(e) => set("full_name", e.target.value)}
          placeholder="Jane Smith" disabled={readOnly} className={ro(errors.full_name && "border-red-400")} />
        <FieldError message={errors.full_name} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email <span className="text-red-500">*</span></label>
          <input type="email" value={fields.email} onChange={(e) => set("email", e.target.value)}
            placeholder="jane@company.com" disabled={readOnly} className={ro(errors.email && "border-red-400")} />
          <FieldError message={errors.email} />
        </div>
        <div>
          <label className="label">Phone <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input type="tel" value={fields.phone} onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 0000" disabled={readOnly} className={ro()} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Department <span className="text-red-500">*</span></label>
          <select value={fields.department_id} onChange={(e) => set("department_id", e.target.value)} disabled={readOnly} className={ro(errors.department_id && "border-red-400")}>
            <option value="">— Select —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <FieldError message={errors.department_id} />
        </div>
        <div>
          <label className="label">Position <span className="text-red-500">*</span></label>
          <input type="text" value={fields.position} onChange={(e) => set("position", e.target.value)}
            placeholder="Senior Developer" disabled={readOnly} className={ro(errors.position && "border-red-400")} />
          <FieldError message={errors.position} />
        </div>
      </div>
      <div>
        <label className="label">Reporting Manager <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
        <select value={fields.manager_id} onChange={(e) => set("manager_id", e.target.value)} disabled={readOnly} className={ro()}>
          <option value="">— No manager —</option>
          {employees.filter((e) => e.status === "active").map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} · {e.position}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="label">Salary <span className="text-red-500">*</span></label>
          <input type="number" min="0" step="0.01" value={fields.salary} onChange={(e) => set("salary", e.target.value)}
            placeholder="0.00" disabled={readOnly} className={ro(`tabular-nums ${errors.salary ? "border-red-400" : ""}`)} />
          <FieldError message={errors.salary} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select value={fields.currency} onChange={(e) => set("currency", e.target.value)} disabled={readOnly} className={ro()}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Hire Date <span className="text-red-500">*</span></label>
        <input type="date" value={fields.hire_date} onChange={(e) => set("hire_date", e.target.value)}
          disabled={readOnly} className={ro(errors.hire_date && "border-red-400")} />
        <FieldError message={errors.hire_date} />
      </div>
    </div>
  );
}
function useDrawerForm(initial: FormFields) {
  const [fields,       setFields]       = useState<FormFields>(initial);
  const [errors,       setErrors]       = useState<FormErrors>({});
  const [submitting,   setSubmitting]   = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle"|"success"|"error">("idle");
  const [serverError,  setServerError]  = useState("");
  const set   = (k: keyof FormFields, v: string) => { setFields((p) => ({ ...p, [k]: v })); if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined })); };
  const reset = (f: FormFields) => { setFields(f); setErrors({}); setSubmitStatus("idle"); setServerError(""); };
  return { fields, errors, setErrors, set, reset, submitting, setSubmitting, submitStatus, setSubmitStatus, serverError, setServerError };
}

// ── Add Employee Drawer ────────────────────────────────────────────────────────
function AddEmployeeDrawer({ open, onClose, onSuccess, departments, employees }: {
  open: boolean; onClose: () => void; onSuccess: (e: Employee) => void;
  departments: Department[]; employees: Employee[];
}) {
  const { can }   = useAuth();
  const canCreate = can.create("hr");
  const form      = useDrawerForm(EMPTY_FORM);
  const firstRef  = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) { form.reset({ ...EMPTY_FORM, hire_date: today() }); setPhotoPreview(null); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const errs = validateForm(form.fields, "add");
    if (Object.keys(errs).length) { form.setErrors(errs); return; }
    form.setSubmitting(true); form.setServerError("");
    try {
      const res  = await fetch("/api/hr/employees", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.fields, salary: parseFloat(form.fields.salary), phone: form.fields.phone || undefined, manager_id: form.fields.manager_id || undefined }),
      });
      const data = await res.json();
      if (!data.success) { form.setSubmitStatus("error"); form.setServerError(data.message || "Failed."); return; }
      let employee = data.data;
      // Upload pending photo if selected before save
      if (photoPreview?.startsWith("blob:")) {
        const blob = await fetch(photoPreview).then((r) => r.blob());
        const file = new File([blob], `photo.${blob.type.split("/")[1]||"jpg"}`, { type: blob.type });
        const fd   = new FormData(); fd.append("photo", file);
        const upRes  = await fetch(`/api/hr/employees/${employee.id}/photo`, { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upData.success) employee = { ...employee, photo_url: upData.data.photo_url };
      }
      form.setSubmitStatus("success"); onSuccess(employee); setTimeout(onClose, 900);
    } catch { form.setSubmitStatus("error"); form.setServerError("Network error."); }
    finally { form.setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Add Employee" subtitle="Create a new employee record" breadcrumb="New Employee">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? <AccessDeniedBanner action="create employees" role="HR Manager" /> : (
          <>
            <PhotoUpload name={form.fields.full_name || "New Employee"} currentUrl={photoPreview} onUploaded={setPhotoPreview} />
            <div className="border-t border-surface-200 pt-5">
              <EmployeeFormFields fields={form.fields} errors={form.errors} set={form.set}
                departments={departments} employees={employees} mode="add" firstRef={firstRef} />
            </div>
          </>
        )}
        {form.serverError && <ErrorBanner message={form.serverError} />}
        {form.submitStatus === "success" && <SuccessBanner message="Employee added successfully!" />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSubmit} submitting={form.submitting} success={form.submitStatus==="success"} submitLabel="Add Employee" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Employee Drawer ───────────────────────────────────────────────────────
function EditEmployeeDrawer({ employee: emp, onClose, onSuccess, departments, employees }: {
  employee: Employee | null; onClose: () => void; onSuccess: (e: Employee) => void;
  departments: Department[]; employees: Employee[];
}) {
  const open = !!emp;
  const { can }      = useAuth();
  const canEdit      = can.edit("hr");
  const canTerminate = can.full("hr");
  const form         = useDrawerForm(EMPTY_FORM);
  const [photoUrl,         setPhotoUrl]         = useState<string | null>(null);
  const [actionLoading,    setActionLoading]    = useState<string | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  useEffect(() => {
    if (emp) {
      form.reset({
        employee_code: emp.employee_code, full_name: emp.full_name, email: emp.email,
        phone: emp.phone || "", department_id: emp.department_id, position: emp.position,
        employment_type: emp.employment_type, salary: String(emp.salary),
        currency: emp.currency, hire_date: emp.hire_date.split("T")[0], manager_id: emp.manager_id || "",
      });
      setPhotoUrl((emp as any).photo_url || null);
      setConfirmTerminate(false);
    }
  }, [emp]);

  const isEditable = emp && emp.status !== "terminated";

  const handleSave = async () => {
    const errs = validateForm(form.fields, "edit");
    if (Object.keys(errs).length || !emp) { form.setErrors(errs); return; }
    form.setSubmitting(true); form.setServerError("");
    try {
      const res  = await fetch(`/api/hr/employees/${emp.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.fields, salary: parseFloat(form.fields.salary), phone: form.fields.phone || undefined, manager_id: form.fields.manager_id || undefined }),
      });
      const data = await res.json();
      if (photoUrl?.startsWith("blob:")) {
        const blob = await fetch(photoUrl).then((r) => r.blob());
        const file = new File(
          [blob],
          `photo.${blob.type.split("/")[1] || "jpg"}`,
          { type: blob.type }
        );

        const fd = new FormData();
        fd.append("photo", file);

        const upRes = await fetch(`/api/hr/employees/${emp.id}/photo`, {
          method: "POST", // ✅ IMPORTANT
          body: fd,
        });

        const upData = await upRes.json();

        if (upData.success) {
          setPhotoUrl(upData.data.photo_url);
        }
      }
      if (data.success) { form.setSubmitStatus("success"); onSuccess({ ...data.data, photo_url: photoUrl }); setTimeout(onClose, 900); }
      else { form.setSubmitStatus("error"); form.setServerError(data.message || "Update failed."); }
    } catch { form.setSubmitStatus("error"); form.setServerError("Network error."); }
    finally { form.setSubmitting(false); }
  };

  const handleStatusChange = async (status: EmployeeStatus) => {
    if (!emp) return;
    setActionLoading(status); form.setServerError("");
    try {
      const res  = await fetch(`/api/hr/employees/${emp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await res.json();
      if (data.success) { onSuccess({ ...data.data, photo_url: photoUrl }); setTimeout(onClose, 300); }
      else form.setServerError(data.message || "Status change failed.");
    } catch(error) { form.setServerError("Network error."); 
      console.log("status error: ", (error as Error).message)
    }
    finally { setActionLoading(null); setConfirmTerminate(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Edit Employee" subtitle={emp ? `${emp.employee_code} · ${emp.full_name}` : ""} breadcrumb="Edit Employee">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {emp && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-100 border border-surface-300">
            <div className="flex items-center gap-2 text-xs"><span className="font-medium text-gray-600">Status:</span><StatusBadge status={emp.status} /></div>
            {!isEditable && <span className="text-xs text-gray-400">Record is read-only</span>}
          </div>
        )}
        {!canEdit && isEditable && <AccessDeniedBanner action="edit employees" role="HR Manager" />}
        <PhotoUpload employeeId={emp?.id} currentUrl={photoUrl} name={emp?.full_name || "Employee"}
          onUploaded={setPhotoUrl} readOnly={!canEdit || !isEditable} />
        <div className="border-t border-surface-200 pt-5">
          <EmployeeFormFields fields={form.fields} errors={form.errors} set={form.set}
            departments={departments} employees={employees.filter((e) => e.id !== emp?.id)}
            mode="edit" readOnly={!canEdit || !isEditable} />
        </div>
        {emp && emp.status !== "terminated" && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Actions</p>
            {emp.status === "active" && (
              <StatusActionButton label="Set to On Leave" icon={UserMinus} colorClass="text-amber-600"
                onClick={() => handleStatusChange("on_leave")} loading={actionLoading === "on_leave"}
                restricted={!canTerminate} requiresRole="HR Manager" />
            )}
            {emp.status === "on_leave" && (
              <StatusActionButton label="Reinstate as Active" icon={UserCheck} colorClass="text-green-600"
                onClick={() => handleStatusChange("active")} loading={actionLoading === "active"}
                restricted={!canTerminate} requiresRole="HR Manager" />
            )}
            {!confirmTerminate ? (
              <button onClick={() => canTerminate && setConfirmTerminate(true)} disabled={!canTerminate}
                className={clsx("flex items-center gap-2 text-xs font-medium transition-colors mt-1",
                  canTerminate ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                <UserX className="w-3.5 h-3.5" /> Terminate employee
                {!canTerminate && <span className="text-gray-400">(HR Manager required)</span>}
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                <p className="text-xs text-red-700 font-medium">Terminate <strong>{emp?.full_name}</strong>? Cannot be undone via UI.</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleStatusChange("terminated")} disabled={!!actionLoading}
                    className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5">
                    {actionLoading === "terminated" ? "Terminating…" : <><UserX className="w-3 h-3" /> Confirm</>}
                  </button>
                  <button onClick={() => setConfirmTerminate(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {form.serverError && <ErrorBanner message={form.serverError} />}
        {form.submitStatus === "success" && <SuccessBanner message="Employee updated!" />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSave} submitting={form.submitting}
        success={form.submitStatus==="success"} submitLabel="Save Changes" disabled={!canEdit || !isEditable} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);
  const [addOpen,      setAddOpen]      = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter,   setDeptFilter]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status",        statusFilter);
    if (deptFilter)   p.set("department_id", deptFilter);
    if (search)       p.set("search",        search);
    fetch(`/api/hr/employees?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setEmployees(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, deptFilter, search]);

  useEffect(() => {
    fetch("/api/hr/departments").then((r) => r.json()).then((res) => { if (res.success) setDepartments(res.data); });
  }, []);
  console.log("departments: ", departments);
  useEffect(() => { load(); }, [load]);

  const handleAdded   = (e: Employee) => { setEmployees((p) => [e, ...p]); setTotal((p) => p + 1); };
  const handleUpdated = (e: Employee) => { setEmployees((p) => p.map((x) => x.id === e.id ? e : x)); };

  const counts = { active: 0, on_leave: 0, terminated: 0 };
  employees.forEach((e) => { if (e.status in counts) (counts as any)[e.status]++; });

  return (
    <>
      <Header title="Employee Directory" subtitle="Human Resources Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            {can.create("hr") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Add Employee</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <AuthStrip userName={user.full_name} userRole={user.role} permissions={[
            { label: "Add",       allowed: can.create("hr") },
            { label: "Edit",      allowed: can.edit("hr") },
            { label: "Terminate", allowed: can.full("hr") },
          ]} />
        )}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {([ ["Active", counts.active, "text-emerald-700", "bg-emerald-50 border-emerald-200"],
                ["On Leave", counts.on_leave, "text-amber-700", "bg-amber-50 border-amber-200"],
                ["Terminated", counts.terminated, "text-red-600", "bg-red-50 border-red-200"] ] as const)
              .map(([label, value, color, bg]) => (
              <div key={label} className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", bg)}>
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={clsx("text-2xl font-bold", color)}>{value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="terminated">Terminated</option>
          </select>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <SectionTitle title="Employees" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Employee","Code","Department","Position","Type","Salary","Hired","Status",""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", h==="Salary" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={9}><TableSkeleton rows={8} cols={9} /></td></tr>
                 : employees.length === 0 ? (
                  <tr><td colSpan={9}>
                    <EmptyState title="No employees found" description="Add your first employee to get started."
                      action={can.create("hr") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Add Employee</button> : undefined} />
                  </td></tr>
                 ) : employees.map((emp) => (
                  <tr key={emp.id} onClick={() => setEditEmployee(emp)} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar emp={emp} />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{emp.full_name}</p>
                          <p className="text-xs text-gray-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{emp.employee_code}</td>
                    <td className="px-4 py-3 text-gray-700">{(emp as any).departments?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{emp.position}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{emp.employment_type.replace("_"," ")}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(emp.salary, emp.currency)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(emp.hire_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                    <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
      <AddEmployeeDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} departments={departments} employees={employees} />
      <EditEmployeeDrawer employee={editEmployee} onClose={() => setEditEmployee(null)} onSuccess={handleUpdated} departments={departments} employees={employees} />
    </>
  );
}
