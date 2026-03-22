import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOvertime, getNbot, getEmployees } from "../api/client.js";
import { format } from "date-fns";
import api from "../api/client.js";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

export default function OvertimeNbot() {
    const qc = useQueryClient();
    const [tab, setTab] = useState("overtime");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ employeeId: "", periodStart: "", periodEnd: "", regularHours: "", overtimeHours: "", hours: "", date: "", notes: "" });

    const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => getEmployees({ active: "true" }) });
    const { data: ot = [] } = useQuery({ queryKey: ["overtime"], queryFn: () => getOvertime({}) });
    const { data: nbotData } = useQuery({ queryKey: ["nbot"], queryFn: () => getNbot({}) });

    async function submitOt() {
        try {
            await api.post("/overtime", { ...form, regularHours: Number(form.regularHours), overtimeHours: Number(form.overtimeHours), periodStart: new Date(form.periodStart), periodEnd: new Date(form.periodEnd) });
            toast.success("Overtime entry created");
            qc.invalidateQueries({ queryKey: ["overtime"] });
            setShowForm(false);
        } catch (e) { toast.error(e.response?.data?.error || "Failed"); }
    }

    async function submitNbot() {
        try {
            await api.post("/nbot", { ...form, hours: Number(form.hours), date: new Date(form.date), periodStart: new Date(form.periodStart), periodEnd: new Date(form.periodEnd) });
            toast.success("NBOT entry created");
            qc.invalidateQueries({ queryKey: ["nbot"] });
            setShowForm(false);
        } catch (e) { toast.error(e.response?.data?.error || "Failed"); }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-header mb-0">Overtime & NBOT Review</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} /> Add Entry</button>
            </div>

            <div className="flex gap-1 mb-6 border-b border-gray-200">
                {["overtime", "nbot"].map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500"}`}>
                        {t === "overtime" ? "Overtime" : "NBOT"}
                    </button>
                ))}
            </div>

            {showForm && (
                <div className="card card-body mb-6">
                    <h3 className="section-title">New {tab === "overtime" ? "Overtime" : "NBOT"} Entry</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="label">Employee</label>
                            <select className="input" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                                <option value="">Select…</option>
                                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        {tab === "overtime" ? (<>
                            <div><label className="label">Regular Hrs</label><input className="input" type="number" value={form.regularHours} onChange={(e) => setForm((f) => ({ ...f, regularHours: e.target.value }))} /></div>
                            <div><label className="label">OT Hrs</label><input className="input" type="number" value={form.overtimeHours} onChange={(e) => setForm((f) => ({ ...f, overtimeHours: e.target.value }))} /></div>
                        </>) : (<>
                            <div><label className="label">NBOT Date</label><input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
                            <div><label className="label">NBOT Hours</label><input className="input" type="number" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} /></div>
                        </>)}
                        <div><label className="label">Period Start</label><input className="input" type="date" value={form.periodStart} onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))} /></div>
                        <div><label className="label">Period End</label><input className="input" type="date" value={form.periodEnd} onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))} /></div>
                        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button className="btn-primary" onClick={tab === "overtime" ? submitOt : submitNbot} disabled={!form.employeeId || !form.periodStart}>Save</button>
                        <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {tab === "overtime" && (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Employee</th><th>Period Start</th><th>Period End</th><th>Regular Hrs</th><th>OT Hrs</th><th>Notes</th></tr></thead>
                        <tbody>
                            {ot.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No overtime entries</td></tr>}
                            {ot.map((e) => (
                                <tr key={e.id}>
                                    <td className="font-medium">{e.employee?.name}</td>
                                    <td>{e.periodStart ? format(new Date(e.periodStart), "MMM d, yyyy") : "—"}</td>
                                    <td>{e.periodEnd ? format(new Date(e.periodEnd), "MMM d, yyyy") : "—"}</td>
                                    <td className="font-mono">{e.regularHours}</td>
                                    <td className="font-mono text-red-600 font-semibold">{e.overtimeHours}</td>
                                    <td className="text-gray-500 text-xs">{e.notes || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === "nbot" && (
                <div className="space-y-6">
                    {/* Totals summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(nbotData?.totals || []).slice(0, 4).map((t) => (
                            <div key={t.employee?.id} className="card p-4">
                                <div className="font-medium text-sm text-gray-800">{t.employee?.name}</div>
                                <div className="text-2xl font-bold text-purple-600 mt-1">{t.totalHours.toFixed(1)}</div>
                                <div className="text-xs text-gray-400">NBOT hrs this period</div>
                            </div>
                        ))}
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Employee</th><th>Date</th><th>Hours</th><th>Period</th><th>Notes</th></tr></thead>
                            <tbody>
                                {(nbotData?.entries || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No NBOT entries</td></tr>}
                                {(nbotData?.entries || []).map((e) => (
                                    <tr key={e.id}>
                                        <td className="font-medium">{e.employee?.name}</td>
                                        <td>{e.date ? format(new Date(e.date), "MMM d, yyyy") : "—"}</td>
                                        <td className="font-mono text-purple-600 font-semibold">{e.hours}</td>
                                        <td className="text-xs text-gray-500">{e.periodStart ? format(new Date(e.periodStart), "M/d") : ""} – {e.periodEnd ? format(new Date(e.periodEnd), "M/d") : ""}</td>
                                        <td className="text-xs text-gray-500">{e.notes || "—"}</td>
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
