import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplates, createTemplate, deleteTemplate, generateFromTemplate, getEmployees } from "../api/client.js";
import { Plus, Trash2, Play, Calendar } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import toast from "react-hot-toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RecurringSchedules() {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [genWeek, setGenWeek] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd"));
    const [form, setForm] = useState({ employeeId: "", name: "Default Schedule", pattern: [], effectiveFrom: new Date().toISOString().slice(0, 10) });
    const [newBlock, setNewBlock] = useState({ dayOfWeek: 0, startTime: "07:00", endTime: "15:00", isNbot: false });

    const { data: templates = [], isLoading } = useQuery({ queryKey: ["recurring"], queryFn: () => getTemplates({}) });
    const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => getEmployees({ active: "true" }) });

    const createMut = useMutation({
        mutationFn: () => createTemplate(form),
        onSuccess: () => { toast.success("Template created"); qc.invalidateQueries({ queryKey: ["recurring"] }); setShowForm(false); },
        onError: (e) => toast.error(e.response?.data?.error || "Failed"),
    });

    const deleteMut = useMutation({
        mutationFn: (id) => deleteTemplate(id),
        onSuccess: () => { toast.success("Template deleted"); qc.invalidateQueries({ queryKey: ["recurring"] }); },
        onError: (e) => toast.error(e.response?.data?.error || "Failed"),
    });

    const genMut = useMutation({
        mutationFn: ({ id }) => generateFromTemplate(id, genWeek),
        onSuccess: (shifts) => { toast.success(`Generated ${shifts.length} shifts`); qc.invalidateQueries({ queryKey: ["schedule"] }); },
        onError: (e) => toast.error(e.response?.data?.error || "Failed"),
    });

    function addBlock() {
        setForm((f) => ({ ...f, pattern: [...f.pattern, { ...newBlock }] }));
    }
    function removeBlock(i) {
        setForm((f) => ({ ...f, pattern: f.pattern.filter((_, j) => j !== i) }));
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-header mb-0">Recurring Schedule Templates</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} /> New Template</button>
            </div>

            {/* Week generator control */}
            <div className="card card-body mb-6 flex items-center gap-4">
                <Calendar size={20} className="text-brand-400 flex-shrink-0" />
                <div>
                    <div className="font-medium text-sm text-gray-800">Generate shifts for week of:</div>
                    <input className="input mt-1 w-44" type="date" value={genWeek} onChange={(e) => setGenWeek(e.target.value)} />
                </div>
                <p className="text-xs text-gray-400 ml-2">Select a template below and click "Generate" to expand it into real shifts for this week.</p>
            </div>

            {showForm && (
                <div className="card card-body mb-6 space-y-4">
                    <h3 className="section-title">New Template</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Employee</label>
                            <select className="input" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                                <option value="">Select employee…</option>
                                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Template Name</label>
                            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">Effective From</label>
                            <input className="input" type="date" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
                        </div>
                    </div>

                    <div className="border border-dashed border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Shift Pattern</h4>
                        <div className="grid grid-cols-4 gap-3 items-end mb-3">
                            <div>
                                <label className="label">Day</label>
                                <select className="input" value={newBlock.dayOfWeek} onChange={(e) => setNewBlock((b) => ({ ...b, dayOfWeek: Number(e.target.value) }))}>
                                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Start</label>
                                <input className="input" type="time" value={newBlock.startTime} onChange={(e) => setNewBlock((b) => ({ ...b, startTime: e.target.value }))} />
                            </div>
                            <div>
                                <label className="label">End</label>
                                <input className="input" type="time" value={newBlock.endTime} onChange={(e) => setNewBlock((b) => ({ ...b, endTime: e.target.value }))} />
                            </div>
                            <div className="flex gap-2 items-end">
                                <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                                    <input type="checkbox" checked={newBlock.isNbot} onChange={(e) => setNewBlock((b) => ({ ...b, isNbot: e.target.checked }))} className="rounded" /> NBOT
                                </label>
                                <button onClick={addBlock} className="btn-outline py-1 px-3"><Plus size={14} /> Add</button>
                            </div>
                        </div>

                        {form.pattern.length === 0 && <p className="text-xs text-gray-400">No blocks yet — add shifts above.</p>}
                        <div className="space-y-1">
                            {form.pattern.map((b, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm bg-gray-50 rounded px-3 py-1.5">
                                    <span className="font-medium w-24">{DAYS[b.dayOfWeek]}</span>
                                    <span className="text-gray-600">{b.startTime} – {b.endTime}</span>
                                    {b.isNbot && <span className="badge badge-purple-alt">NBOT</span>}
                                    <button onClick={() => removeBlock(i)} className="ml-auto text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => createMut.mutate()} className="btn-primary" disabled={createMut.isPending || !form.employeeId || form.pattern.length === 0}>
                            {createMut.isPending ? "Creating…" : "Create Template"}
                        </button>
                        <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
                    </div>
                </div>
            )}

            {/* Template list */}
            {isLoading && <div className="text-gray-400 py-8 text-center">Loading templates…</div>}
            <div className="space-y-4">
                {templates.map((tpl) => (
                    <div key={tpl.id} className="card card-body flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="font-semibold text-gray-900">{tpl.name}</div>
                                <div className="text-sm text-gray-500">{tpl.employee?.name} · Effective {format(new Date(tpl.effectiveFrom), "MMM d, yyyy")}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => genMut.mutate({ id: tpl.id })} className="btn-outline py-1 px-3 text-sm" disabled={genMut.isPending}>
                                    <Play size={14} /> Generate
                                </button>
                                <button onClick={() => deleteMut.mutate(tpl.id)} className="btn-danger py-1 px-3 text-sm"><Trash2 size={14} /></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(tpl.pattern || []).map((b, i) => (
                                <span key={i} className="badge badge-gray px-2 py-1">
                                    {DAYS[b.dayOfWeek]?.slice(0, 3)} {b.startTime}–{b.endTime}
                                    {b.isNbot && " (NBOT)"}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
                {templates.length === 0 && !isLoading && (
                    <div className="text-center text-gray-400 py-12">No templates yet. Create one to start building recurring schedules.</div>
                )}
            </div>
        </div>
    );
}
