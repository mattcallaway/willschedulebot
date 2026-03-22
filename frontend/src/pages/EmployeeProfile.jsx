import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployee, updateEmployee, getCredentials, updateCredentials, getPtoLedger, getSickLedger } from "../api/client.js";
import { Save, ArrowLeft, BookOpen, Award } from "lucide-react";
import toast from "react-hot-toast";

function Field({ label, name, value, onChange, type = "text" }) {
    return (
        <div>
            <label className="label">{label}</label>
            <input className="input" type={type} name={name} value={value ?? ""} onChange={onChange} />
        </div>
    );
}

export default function EmployeeProfile() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [tab, setTab] = useState("profile");

    const { data: emp, isLoading } = useQuery({ queryKey: ["employee", id], queryFn: () => getEmployee(id) });
    const { data: creds = {} } = useQuery({ queryKey: ["creds", id], queryFn: () => getCredentials(id) });
    const { data: ptoData } = useQuery({ queryKey: ["pto", id], queryFn: () => getPtoLedger(id) });
    const { data: sickData } = useQuery({ queryKey: ["sick", id], queryFn: () => getSickLedger(id) });

    const [form, setForm] = useState(null);
    const [credForm, setCred] = useState(null);

    if (emp && !form) setForm({ ...emp, hireDate: emp.hireDate?.slice(0, 10) });
    if (creds && !credForm) setCred({ ...creds, licenseExpiry: creds.licenseExpiry?.slice(0, 10) });

    const saveMut = useMutation({
        mutationFn: () => updateEmployee(id, form),
        onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["employee", id] }); },
        onError: (e) => toast.error(e.response?.data?.error || "Save failed"),
    });

    const saveCredMut = useMutation({
        mutationFn: () => updateCredentials(id, credForm),
        onSuccess: () => { toast.success("Credentials saved"); qc.invalidateQueries({ queryKey: ["creds", id] }); },
        onError: (e) => toast.error(e.response?.data?.error || "Save failed"),
    });

    function onChange(e) {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    }
    function onCredChange(e) {
        const { name, value } = e.target;
        setCred((c) => ({ ...c, [name]: value }));
    }

    if (isLoading || !form || !credForm) return <div className="p-8 text-gray-400">Loading…</div>;

    const tabs = ["profile", "credentials", "leave-ledger"];

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <Link to="/employees" className="btn-ghost"><ArrowLeft size={16} /> Back</Link>
                <h1 className="page-header mb-0">{form.name}</h1>
                {form.status && (
                    <span className={`badge ${form.status === "Active" ? "badge-green" : "badge-gray"}`}>{form.status}</span>
                )}
                {form.contractedWeeklyHours <= 32 && <span className="badge badge-blue">32hr</span>}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
                {tabs.map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        {t === "profile" ? "Profile" : t === "credentials" ? "Credentials" : "PTO & Sick Ledger"}
                    </button>
                ))}
                <Link to={`/ledger/${id}`} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-brand-600">
                    Full Ledger →
                </Link>
            </div>

            {/* Profile Tab */}
            {tab === "profile" && (
                <div className="space-y-6">
                    <div className="card card-body">
                        <h3 className="section-title">Roster Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <Field label="Full Name" name="name" value={form.name} onChange={onChange} />
                            <Field label="NUID" name="nuid" value={form.nuid} onChange={onChange} />
                            <Field label="Rank / Title" name="rank" value={form.rank} onChange={onChange} />
                            <Field label="Phone" name="phone" value={form.phone} onChange={onChange} type="tel" />
                            <Field label="Email" name="email" value={form.email} onChange={onChange} type="email" />
                            <Field label="KP Email" name="kpEmail" value={form.kpEmail} onChange={onChange} type="email" />
                            <Field label="Shift" name="shift" value={form.shift} onChange={onChange} />
                            <Field label="Status" name="status" value={form.status} onChange={onChange} />
                            <Field label="Hire Date" name="hireDate" value={form.hireDate} onChange={onChange} type="date" />
                            <Field label="Last 4 SSN" name="last4" value={form.last4} onChange={onChange} />
                            <Field label="BCI #" name="bciNumber" value={form.bciNumber} onChange={onChange} />
                            <Field label="Badge #" name="badgeNumber" value={form.badgeNumber} onChange={onChange} />
                            <div className="flex items-center gap-3 mt-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <input type="checkbox" name="bwcIssued" checked={!!form.bwcIssued} onChange={onChange} className="rounded" />
                                    BWC Issued
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <input type="checkbox" name="cedIssued" checked={!!form.cedIssued} onChange={onChange} className="rounded" />
                                    CED Issued
                                </label>
                            </div>
                            <div className="col-span-full">
                                <label className="label">Notes</label>
                                <textarea className="input h-20 resize-none" name="notes" value={form.notes ?? ""} onChange={onChange} />
                            </div>
                        </div>
                    </div>

                    <div className="card card-body">
                        <h3 className="section-title">Operational Fields</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="label">Contracted Weekly Hours</label>
                                <select className="input" name="contractedWeeklyHours" value={form.contractedWeeklyHours} onChange={(e) => setForm((f) => ({ ...f, contractedWeeklyHours: Number(e.target.value) }))}>
                                    <option value={32}>32 hours</option>
                                    <option value={40}>40 hours</option>
                                </select>
                            </div>
                            <Field label="Employment Type" name="employmentType" value={form.employmentType} onChange={onChange} />
                            <Field label="Default Shift Hrs" name="defaultShiftLength" value={form.defaultShiftLength} onChange={onChange} type="number" />
                            <Field label="PTO Accrual Rate" name="ptoAccrualRate" value={form.ptoAccrualRate} onChange={onChange} type="number" />
                            <Field label="Sick Accrual Rate" name="sickAccrualRate" value={form.sickAccrualRate} onChange={onChange} type="number" />
                            <Field label="PTO Balance" name="ptoBalance" value={form.ptoBalance} onChange={(e) => setForm((f) => ({ ...f, ptoBalance: Number(e.target.value) }))} type="number" />
                            <Field label="Sick Balance" name="sickBalance" value={form.sickBalance} onChange={(e) => setForm((f) => ({ ...f, sickBalance: Number(e.target.value) }))} type="number" />
                            <Field label="OT Threshold (hrs)" name="overtimeThreshold" value={form.overtimeThreshold} onChange={(e) => setForm((f) => ({ ...f, overtimeThreshold: Number(e.target.value) }))} type="number" />
                            <div className="flex items-center gap-3 mt-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <input type="checkbox" name="nbotEligible" checked={!!form.nbotEligible} onChange={onChange} className="rounded" />
                                    NBOT Eligible
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <input type="checkbox" name="active" checked={!!form.active} onChange={onChange} className="rounded" />
                                    Active
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button onClick={() => saveMut.mutate()} className="btn-primary" disabled={saveMut.isPending}>
                            <Save size={16} /> {saveMut.isPending ? "Saving…" : "Save Profile"}
                        </button>
                    </div>
                </div>
            )}

            {/* Credentials Tab */}
            {tab === "credentials" && (
                <div className="card card-body">
                    <h3 className="section-title">Credentials & Licensing</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            ["License / Guard Card #", "licenseNumber"],
                            ["License Expiry", "licenseExpiry", "date"],
                            ["Guard Card #", "guardCardNumber"],
                            ["FARM Card #", "farmCardNumber"],
                            ["Firearm Info", "firearmInfo"],
                            ["Firearm Serial #", "firearmSerial"],
                        ].map(([label, name, type = "text"]) => (
                            <div key={name}>
                                <label className="label">{label}</label>
                                <input className="input" type={type} name={name} value={credForm[name] ?? ""} onChange={onCredChange} />
                            </div>
                        ))}
                    </div>
                    {credForm.licenseExpiry && new Date(credForm.licenseExpiry) < new Date() && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
                            ⚠️ License is expired — renewal required
                        </div>
                    )}
                    <div className="flex justify-end mt-6">
                        <button onClick={() => saveCredMut.mutate()} className="btn-primary" disabled={saveCredMut.isPending}>
                            <Save size={16} /> {saveCredMut.isPending ? "Saving…" : "Save Credentials"}
                        </button>
                    </div>
                </div>
            )}

            {/* PTO / Sick quick view */}
            {tab === "leave-ledger" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PTO */}
                    <div className="card">
                        <div className="card-header flex items-center justify-between">
                            PTO Balance: <span className="font-bold text-brand-600 ml-2">{ptoData?.balance?.toFixed(1) ?? "—"} hrs</span>
                        </div>
                        <table className="table">
                            <thead><tr><th>Date</th><th>Type</th><th>Hours</th><th>Balance</th></tr></thead>
                            <tbody>
                                {(ptoData?.entries || []).slice(0, 8).map((e) => (
                                    <tr key={e.id}>
                                        <td className="text-xs">{new Date(e.createdAt).toLocaleDateString()}</td>
                                        <td><span className={`badge ${e.type === "accrual" ? "badge-green" : e.type === "usage" ? "badge-red" : "badge-yellow"}`}>{e.type}</span></td>
                                        <td className={e.hours > 0 ? "text-green-600 font-mono" : "text-red-600 font-mono"}>{e.hours > 0 ? "+" : ""}{e.hours?.toFixed(2)}</td>
                                        <td className="font-mono text-sm">{e.balance?.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Sick */}
                    <div className="card">
                        <div className="card-header flex items-center justify-between">
                            Sick Balance: <span className="font-bold text-rose-600 ml-2">{sickData?.balance?.toFixed(1) ?? "—"} hrs</span>
                        </div>
                        <table className="table">
                            <thead><tr><th>Date</th><th>Type</th><th>Hours</th><th>Balance</th></tr></thead>
                            <tbody>
                                {(sickData?.entries || []).slice(0, 8).map((e) => (
                                    <tr key={e.id}>
                                        <td className="text-xs">{new Date(e.createdAt).toLocaleDateString()}</td>
                                        <td><span className={`badge ${e.type === "accrual" ? "badge-green" : e.type === "usage" ? "badge-red" : "badge-yellow"}`}>{e.type}</span></td>
                                        <td className={e.hours > 0 ? "text-green-600 font-mono" : "text-red-600 font-mono"}>{e.hours > 0 ? "+" : ""}{e.hours?.toFixed(2)}</td>
                                        <td className="font-mono text-sm">{e.balance?.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
