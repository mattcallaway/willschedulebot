import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeaveRequests, createLeave, updateLeave, deleteLeave, getEmployees } from "../api/client.js";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const LEAVE_TYPES = ["pto", "sick", "outage", "unpaid", "fmla", "other"];

export default function LeaveManager() {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ employeeId: "", type: "pto", startDate: "", endDate: "", hours: "", reason: "", status: "approved" });

    const { data: leave = [], isLoading } = useQuery({ queryKey: ["leave"], queryFn: () => getLeaveRequests({}) });
    const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => getEmployees({ active: "true" }) });

    const createMut = useMutation({
        mutationFn: () => createLeave({ ...form, hours: Number(form.hours) }),
        onSuccess: () => { toast.success("Leave request created"); qc.invalidateQueries({ queryKey: ["leave"] }); setShowForm(false); },
        onError: (e) => toast.error(e.response?.data?.error || "Failed"),
    });

    const deleteMut = useMutation({
        mutationFn: (id) => deleteLeave(id),
        onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["leave"] }); },
        onError: (e) => toast.error(e.response?.data?.error || "Failed"),
    });

    const statusColors = { pto: "badge-blue", sick: "badge-red", outage: "badge-gray", unpaid: "badge-gray", fmla: "badge-yellow", other: "badge-gray" };
    const approvedColors = { approved: "badge-green", pending: "badge-yellow", denied: "badge-red" };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-header mb-0">Leave & Outage Manager</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} /> Add Leave</button>
            </div>

            {showForm && (
                <div className="card card-body mb-6">
                    <h3 className="section-title">New Leave Request</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="label">Employee</label>
                            <select className="input" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                                <option value="">Select employee…</option>
                                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Type</label>
                            <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                                {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Start Date</label>
                            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">End Date</label>
                            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">Hours</label>
                            <input className="input" type="number" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="8" />
                        </div>
                        <div>
                            <label className="label">Status</label>
                            <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                                <option value="approved">Approved</option>
                                <option value="pending">Pending</option>
                                <option value="denied">Denied</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="label">Reason</label>
                            <input className="input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional reason…" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => createMut.mutate()} className="btn-primary" disabled={createMut.isPending || !form.employeeId || !form.startDate}>
                            {createMut.isPending ? "Saving…" : "Create Leave Request"}
                        </button>
                        <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
                    </div>
                </div>
            )}

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Hours</th><th>Status</th><th>Reason</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>}
                        {!isLoading && leave.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">No leave requests</td></tr>}
                        {leave.map((l) => (
                            <tr key={l.id}>
                                <td className="font-medium">{l.employee?.name}</td>
                                <td><span className={`badge ${statusColors[l.type] || "badge-gray"}`}>{l.type}</span></td>
                                <td>{format(new Date(l.startDate), "MMM d, yyyy")}</td>
                                <td>{format(new Date(l.endDate), "MMM d, yyyy")}</td>
                                <td className="font-mono">{l.hours}</td>
                                <td><span className={`badge ${approvedColors[l.status]}`}>{l.status}</span></td>
                                <td className="text-xs text-gray-500 max-w-[200px] truncate">{l.reason || "—"}</td>
                                <td>
                                    <button onClick={() => deleteMut.mutate(l.id)} className="text-red-400 hover:text-red-600">
                                        <Trash2 size={15} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
