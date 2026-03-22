import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployee, updateEmployee, getPtoLedger, getSickLedger } from "../api/client.js";
import { Save, ArrowLeft, BookOpen } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

function Field({ label, name, value, onChange, type = "text", readOnly = false }) {
    return (
        <div>
            <label className="label">{label}</label>
            <input
                className={`input ${readOnly ? "bg-gray-50 text-gray-500" : ""}`}
                type={type}
                name={name}
                value={value ?? ""}
                onChange={onChange}
                readOnly={readOnly}
            />
        </div>
    );
}

function parseDate(val) {
    if (!val) return "";
    try { return new Date(val).toISOString().slice(0, 10); } catch { return ""; }
}

export default function EmployeeProfile() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [tab, setTab] = useState("roster");

    const { data: emp, isLoading } = useQuery({
        queryKey: ["employee", id],
        queryFn: () => getEmployee(id),
    });
    const { data: ptoData } = useQuery({ queryKey: ["pto", id], queryFn: () => getPtoLedger(id), enabled: tab === "ledger" });
    const { data: sickData } = useQuery({ queryKey: ["sick", id], queryFn: () => getSickLedger(id), enabled: tab === "ledger" });

    const [form, setForm] = useState(null);

    // Hydrate form from fetched employee (only once)
    if (emp && !form) {
        setForm({
            ...emp,
            hireDate: parseDate(emp.hireDate),
            licenseExpiryPrimary: parseDate(emp.licenseExpiryPrimary),
            licenseExpirySecondary: parseDate(emp.licenseExpirySecondary),
        });
    }

    const saveMut = useMutation({
        mutationFn: () => updateEmployee(id, form),
        onSuccess: () => {
            toast.success("Profile saved");
            qc.invalidateQueries({ queryKey: ["employee", id] });
            qc.invalidateQueries({ queryKey: ["employees"] });
        },
        onError: (e) => toast.error(e.response?.data?.error || "Save failed"),
    });

    function onChange(e) {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    }
    function onNumber(name) {
        return (e) => setForm((f) => ({ ...f, [name]: e.target.value === "" ? null : Number(e.target.value) }));
    }

    if (isLoading || !form) return <div className="p-10 text-gray-400 text-center">Loading employee…</div>;

    // License expiry state
    const primaryExpired = form.licenseExpiryPrimary && new Date(form.licenseExpiryPrimary) < new Date();
    const secondaryExpired = form.licenseExpirySecondary && new Date(form.licenseExpirySecondary) < new Date();

    const TABS = [
        { id: "roster", label: "Roster Info" },
        { id: "credentials", label: "Credentials & Firearm" },
        { id: "operational", label: "Operational" },
        { id: "ledger", label: "PTO & Sick Ledger" },
    ];

    return (
        <div>
            {/* Page header */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                <Link to="/employees" className="btn-ghost"><ArrowLeft size={16} /> Directory</Link>
                <h1 className="page-header mb-0">{form.name}</h1>
                {form.status && (
                    <span className={`badge ${form.status === "Active" ? "badge-green" : "badge-gray"}`}>{form.status}</span>
                )}
                {form.rank && <span className="badge badge-blue">{form.rank}</span>}
                {form.contractedWeeklyHours <= 32 && <span className="badge badge-yellow">32hr Priority</span>}
                <Link to={`/ledger/${id}`} className="btn-ghost ml-auto"><BookOpen size={16} /> Full Ledger</Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-6 border-b border-gray-200 overflow-x-auto">
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.id ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── ROSTER TAB ── */}
            {tab === "roster" && (
                <div className="space-y-6">
                    <div className="card card-body">
                        <h3 className="section-title">Identity</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <Field label="Full Name" name="name" value={form.name} onChange={onChange} />
                            <Field label="NUID" name="nuid" value={form.nuid} onChange={onChange} />
                            <Field label="Rank" name="rank" value={form.rank} onChange={onChange} />
                            <Field label="Status" name="status" value={form.status} onChange={onChange} />
                            <Field label="Hire Date" name="hireDate" value={form.hireDate} onChange={onChange} type="date" />
                            <Field label="Badge #" name="badgeNumber" value={form.badgeNumber} onChange={onChange} />
                            <Field label="BCI #" name="bciNumber" value={form.bciNumber} onChange={onChange} />
                            <Field label="Last 4 SSN" name="last4" value={form.last4} onChange={onChange} />
                        </div>
                    </div>

                    <div className="card card-body">
                        <h3 className="section-title">Contact</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <Field label="Phone" name="phone" value={form.phone} onChange={onChange} type="tel" />
                            <Field label="Email" name="email" value={form.email} onChange={onChange} type="email" />
                            <Field label="KP Email" name="kpEmail" value={form.kpEmail} onChange={onChange} />
                            <Field label="Shift" name="shiftText" value={form.shiftText} onChange={onChange} />
                        </div>
                    </div>

                    <div className="card card-body">
                        <h3 className="section-title">Equipment</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="BWC Issued (serial/ID)" name="bwcIssued" value={form.bwcIssued} onChange={onChange} />
                            <Field label="CED Issued (serial/ID)" name="cedIssued" value={form.cedIssued} onChange={onChange} />
                        </div>
                        <div className="mt-4">
                            <label className="label">Notes</label>
                            <textarea className="input h-20 resize-none" name="notes" value={form.notes ?? ""} onChange={onChange} />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button className="btn-primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                            <Save size={16} /> {saveMut.isPending ? "Saving…" : "Save Roster Info"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── CREDENTIALS TAB ── */}
            {tab === "credentials" && (
                <div className="space-y-6">
                    <div className="card card-body">
                        <h3 className="section-title">License & Guard Card</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Field label="License / Guard Card #" name="licenseGuardCardNumber" value={form.licenseGuardCardNumber} onChange={onChange} />
                            <div>
                                <label className="label">License Expiry (Primary)</label>
                                <input className={`input ${primaryExpired ? "border-red-400" : ""}`} type="date" name="licenseExpiryPrimary" value={form.licenseExpiryPrimary} onChange={onChange} />
                                {primaryExpired && <p className="text-xs text-red-600 mt-1">⚠ Expired — renewal required</p>}
                            </div>
                            <div>
                                <label className="label">License Expiry (Secondary)</label>
                                <input className={`input ${secondaryExpired ? "border-red-400" : ""}`} type="date" name="licenseExpirySecondary" value={form.licenseExpirySecondary} onChange={onChange} />
                                {secondaryExpired && <p className="text-xs text-red-600 mt-1">⚠ Expired — renewal required</p>}
                            </div>
                            <Field label="FARM Card #" name="farmCardNumber" value={form.farmCardNumber} onChange={onChange} />
                        </div>
                    </div>

                    <div className="card card-body">
                        <h3 className="section-title">Firearm</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Firearm Info" name="firearmInfo" value={form.firearmInfo} onChange={onChange} />
                            <Field label="Firearm Serial #" name="firearmSerialNumber" value={form.firearmSerialNumber} onChange={onChange} />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button className="btn-primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                            <Save size={16} /> {saveMut.isPending ? "Saving…" : "Save Credentials"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── OPERATIONAL TAB ── */}
            {tab === "operational" && (
                <div className="space-y-6">
                    <div className="card card-body">
                        <h3 className="section-title">Scheduling Configuration</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            <span className="font-semibold text-amber-600">Contracted Weekly Hours</span> is the primary driver of coverage priority — 32hr employees are offered shifts before 40hr employees.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="label">Contracted Weekly Hours <span className="text-brand-500">★ Priority Field</span></label>
                                <select className="input" name="contractedWeeklyHours" value={form.contractedWeeklyHours}
                                    onChange={(e) => setForm((f) => ({ ...f, contractedWeeklyHours: Number(e.target.value) }))}>
                                    <option value={32}>32 hours / week (priority)</option>
                                    <option value={40}>40 hours / week (standard)</option>
                                </select>
                            </div>
                            <Field label="OT Threshold (hrs/week)" name="overtimeThreshold" value={form.overtimeThreshold} onChange={onNumber("overtimeThreshold")} type="number" />
                            <Field label="Seniority Rank" name="seniorityRank" value={form.seniorityRank} onChange={onNumber("seniorityRank")} type="number" />
                            <Field label="Shift Text" name="shiftText" value={form.shiftText} onChange={onChange} />
                            <Field label="Outage Status" name="outageStatus" value={form.outageStatus} onChange={onChange} />
                            <div>
                                <label className="label">Active</label>
                                <select className="input" name="activeFlag" value={form.activeFlag ? "true" : "false"}
                                    onChange={(e) => setForm((f) => ({ ...f, activeFlag: e.target.value === "true" }))}>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="card card-body">
                        <h3 className="section-title">PTO & Sick Balances</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Field label="PTO Balance (hrs)" name="ptoBalance" value={form.ptoBalance} onChange={onNumber("ptoBalance")} type="number" />
                            <Field label="Sick Balance (hrs)" name="sickBalance" value={form.sickBalance} onChange={onNumber("sickBalance")} type="number" />
                            <Field label="PTO Accrual Rate" name="ptoAccrualRate" value={form.ptoAccrualRate} onChange={onNumber("ptoAccrualRate")} type="number" />
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                    <input type="checkbox" name="nbotEligible" checked={!!form.nbotEligible}
                                        onChange={(e) => setForm((f) => ({ ...f, nbotEligible: e.target.checked }))} className="rounded" />
                                    NBOT Eligible
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="card card-body">
                        <h3 className="section-title">Advanced Rules</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">OT Rule (JSON or note)</label>
                                <textarea className="input h-16 resize-none font-mono text-xs" name="overtimeRule" value={form.overtimeRule ?? ""} onChange={onChange} />
                            </div>
                            <div>
                                <label className="label">NBOT Rule (JSON or note)</label>
                                <textarea className="input h-16 resize-none font-mono text-xs" name="nbotRule" value={form.nbotRule ?? ""} onChange={onChange} />
                            </div>
                            <div>
                                <label className="label">Qualification Flags (JSON array)</label>
                                <input className="input font-mono text-xs" name="qualificationFlags" value={form.qualificationFlags ?? ""} onChange={onChange} placeholder='["apo","firearm"]' />
                            </div>
                            <div>
                                <label className="label">Availability Notes</label>
                                <textarea className="input h-16 resize-none" name="availabilityNotes" value={form.availabilityNotes ?? ""} onChange={onChange} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button className="btn-primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                            <Save size={16} /> {saveMut.isPending ? "Saving…" : "Save Operational Settings"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── LEDGER QUICK VIEW TAB ── */}
            {tab === "ledger" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {[
                        { label: "PTO", data: ptoData, accentClass: "text-brand-600" },
                        { label: "Sick", data: sickData, accentClass: "text-rose-600" },
                    ].map(({ label, data, accentClass }) => (
                        <div key={label} className="card">
                            <div className="card-header flex items-center justify-between">
                                <span>{label} Balance:</span>
                                <span className={`font-bold ${accentClass}`}>{data?.balance?.toFixed(1) ?? "—"} hrs</span>
                            </div>
                            <table className="table">
                                <thead><tr><th>Date</th><th>Type</th><th>Hours</th><th>Balance</th></tr></thead>
                                <tbody>
                                    {(data?.entries || []).slice(0, 10).map((e) => (
                                        <tr key={e.id}>
                                            <td className="text-xs">{format(new Date(e.createdAt), "MMM d, yyyy")}</td>
                                            <td><span className={`badge ${e.type === "accrual" ? "badge-green" : e.type === "usage" ? "badge-red" : "badge-yellow"}`}>{e.type}</span></td>
                                            <td className={`font-mono ${e.hours > 0 ? "text-green-600" : "text-red-600"}`}>{e.hours > 0 ? "+" : ""}{e.hours?.toFixed(2)}</td>
                                            <td className="font-mono text-sm">{e.balance?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {(!data?.entries || data.entries.length === 0) && (
                                        <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-sm">No entries yet</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
