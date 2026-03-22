import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPtoLedger, getSickLedger, adjustBalance, triggerAccrual, getEmployee } from "../api/client.js";
import { ArrowLeft, Plus } from "lucide-react";
import toast from "react-hot-toast";

export default function LedgerView() {
    const { employeeId } = useParams();
    const qc = useQueryClient();
    const [adjForm, setAdjForm] = useState({ leaveType: "pto", hours: "", reason: "" });
    const [showAdj, setShowAdj] = useState(false);

    const { data: emp } = useQuery({ queryKey: ["employee", employeeId], queryFn: () => getEmployee(employeeId) });
    const { data: ptoData } = useQuery({ queryKey: ["pto", employeeId], queryFn: () => getPtoLedger(employeeId) });
    const { data: sickData } = useQuery({ queryKey: ["sick", employeeId], queryFn: () => getSickLedger(employeeId) });

    const adjMut = useMutation({
        mutationFn: () => adjustBalance({ employeeId, leaveType: adjForm.leaveType, hours: Number(adjForm.hours), reason: adjForm.reason }),
        onSuccess: () => {
            toast.success("Balance adjusted");
            qc.invalidateQueries({ queryKey: ["pto", employeeId] });
            qc.invalidateQueries({ queryKey: ["sick", employeeId] });
            setShowAdj(false);
        },
        onError: (e) => toast.error(e.response?.data?.error || "Adjustment failed"),
    });

    function LedgerTable({ data, label, accentClass }) {
        return (
            <div className="card">
                <div className="card-header flex items-center justify-between">
                    <span>{label} Balance: <span className={`font-bold ${accentClass}`}>{data?.balance?.toFixed(2) ?? "—"} hrs</span></span>
                </div>
                <table className="table">
                    <thead><tr><th>Date</th><th>Type</th><th>Hours</th><th>Balance</th><th>Reason</th></tr></thead>
                    <tbody>
                        {(data?.entries || []).map((e) => (
                            <tr key={e.id}>
                                <td className="text-xs">{new Date(e.createdAt).toLocaleDateString()}</td>
                                <td><span className={`badge ${e.type === "accrual" ? "badge-green" : e.type === "usage" ? "badge-red" : "badge-yellow"}`}>{e.type}</span></td>
                                <td className={`font-mono ${e.hours > 0 ? "text-green-600" : "text-red-600"}`}>{e.hours > 0 ? "+" : ""}{e.hours?.toFixed(2)}</td>
                                <td className="font-mono text-sm">{e.balance?.toFixed(2)}</td>
                                <td className="text-gray-500 text-xs truncate max-w-[200px]">{e.reason || "—"}</td>
                            </tr>
                        ))}
                        {(data?.entries || []).length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-400">No entries</td></tr>}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <Link to={`/employees/${employeeId}`} className="btn-ghost"><ArrowLeft size={16} /> Back to Profile</Link>
                <h1 className="page-header mb-0">Leave Ledger — {emp?.name}</h1>
                <button onClick={() => setShowAdj(!showAdj)} className="btn-outline ml-auto"><Plus size={16} /> Manual Adjustment</button>
            </div>

            {showAdj && (
                <div className="card card-body mb-6">
                    <h3 className="section-title">Manual Balance Adjustment</h3>
                    <p className="text-sm text-gray-500 mb-4">Use this to correct balances, apply carryovers, or make record corrections. All adjustments are logged.</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="label">Leave Type</label>
                            <select className="input" value={adjForm.leaveType} onChange={(e) => setAdjForm((f) => ({ ...f, leaveType: e.target.value }))}>
                                <option value="pto">PTO</option>
                                <option value="sick">Sick</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Hours (+ to add, − to deduct)</label>
                            <input className="input" type="number" value={adjForm.hours} onChange={(e) => setAdjForm((f) => ({ ...f, hours: e.target.value }))} placeholder="e.g. 8 or -4" />
                        </div>
                        <div>
                            <label className="label">Reason (required)</label>
                            <input className="input" value={adjForm.reason} onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Why are you adjusting?" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => adjMut.mutate()} className="btn-primary" disabled={adjMut.isPending || !adjForm.hours || !adjForm.reason}>
                            {adjMut.isPending ? "Saving…" : "Save Adjustment"}
                        </button>
                        <button onClick={() => setShowAdj(false)} className="btn-ghost">Cancel</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <LedgerTable data={ptoData} label="PTO" accentClass="text-brand-600" />
                <LedgerTable data={sickData} label="Sick" accentClass="text-rose-600" />
            </div>
        </div>
    );
}
