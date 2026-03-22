import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHoursReport, getPtoReport, getSickReport, getOvertimeReport, getNbotReport, getSeniorityReport, getCredentialsReport } from "../api/client.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";

const REPORTS = [
    { id: "hours", label: "Scheduled Hours" },
    { id: "pto", label: "PTO Balances" },
    { id: "sick", label: "Sick Balances" },
    { id: "overtime", label: "Overtime" },
    { id: "nbot", label: "NBOT" },
    { id: "seniority", label: "Seniority Roster" },
    { id: "credentials", label: "Credential Expiry" },
];

export default function Reports() {
    const [activeReport, setActiveReport] = useState("hours");

    const { data: hours = [] } = useQuery({ queryKey: ["rpt-hours"], queryFn: getHoursReport, enabled: activeReport === "hours" });
    const { data: pto = [] } = useQuery({ queryKey: ["rpt-pto"], queryFn: getPtoReport, enabled: activeReport === "pto" });
    const { data: sick = [] } = useQuery({ queryKey: ["rpt-sick"], queryFn: getSickReport, enabled: activeReport === "sick" });
    const { data: ot = [] } = useQuery({ queryKey: ["rpt-ot"], queryFn: getOvertimeReport, enabled: activeReport === "overtime" });
    const { data: nbot } = useQuery({ queryKey: ["rpt-nbot"], queryFn: getNbotReport, enabled: activeReport === "nbot" });
    const { data: seniority = [] } = useQuery({ queryKey: ["rpt-sen"], queryFn: getSeniorityReport, enabled: activeReport === "seniority" });
    const { data: creds = [] } = useQuery({ queryKey: ["rpt-creds"], queryFn: getCredentialsReport, enabled: activeReport === "credentials" });

    return (
        <div>
            <h1 className="page-header">Reports & Dashboards</h1>

            {/* Report selector */}
            <div className="flex flex-wrap gap-2 mb-6">
                {REPORTS.map((r) => (
                    <button key={r.id} onClick={() => setActiveReport(r.id)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeReport === r.id ? "bg-brand-500 text-white border-brand-500" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        {r.label}
                    </button>
                ))}
            </div>

            {/* Hours Report */}
            {activeReport === "hours" && (
                <div className="space-y-6">
                    <div className="card card-body">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={hours.slice(0, 20)} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="regularHours" fill="#4361ee" name="Regular" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="overtimeHours" fill="#f59e0b" name="Overtime" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="nbotHours" fill="#8b5cf6" name="NBOT" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Employee</th><th>Rank</th><th>Regular Hrs</th><th>OT Hrs</th><th>NBOT Hrs</th><th>Total</th></tr></thead>
                            <tbody>
                                {hours.map((e) => (
                                    <tr key={e.id}>
                                        <td className="font-medium">{e.name}</td>
                                        <td>{e.rank}</td>
                                        <td className="font-mono">{e.regularHours?.toFixed(1)}</td>
                                        <td className="font-mono text-amber-600">{e.overtimeHours?.toFixed(1)}</td>
                                        <td className="font-mono text-purple-600">{e.nbotHours?.toFixed(1)}</td>
                                        <td className="font-mono font-semibold">{((e.regularHours || 0) + (e.overtimeHours || 0) + (e.nbotHours || 0)).toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PTO Report */}
            {activeReport === "pto" && (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Employee</th><th>Rank</th><th>PTO Balance (hrs)</th></tr></thead>
                        <tbody>
                            {pto.map((e) => (
                                <tr key={e.id}>
                                    <td className="font-medium">{e.name}</td>
                                    <td>{e.rank}</td>
                                    <td className={`font-mono font-semibold ${e.ptoBalance < 8 ? "text-red-600" : "text-green-600"}`}>{e.ptoBalance?.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sick Report */}
            {activeReport === "sick" && (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Employee</th><th>Rank</th><th>Sick Balance (hrs)</th></tr></thead>
                        <tbody>
                            {sick.map((e) => (
                                <tr key={e.id}>
                                    <td className="font-medium">{e.name}</td>
                                    <td>{e.rank}</td>
                                    <td className={`font-mono font-semibold ${e.sickBalance < 4 ? "text-red-600" : "text-blue-600"}`}>{e.sickBalance?.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* OT Report */}
            {activeReport === "overtime" && (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Employee</th><th>Period Start</th><th>Period End</th><th>Regular Hrs</th><th>OT Hrs</th></tr></thead>
                        <tbody>
                            {ot.map((e) => (
                                <tr key={e.id}>
                                    <td className="font-medium">{e.employee?.name}</td>
                                    <td className="text-xs">{e.periodStart ? format(new Date(e.periodStart), "MMM d, yyyy") : "—"}</td>
                                    <td className="text-xs">{e.periodEnd ? format(new Date(e.periodEnd), "MMM d, yyyy") : "—"}</td>
                                    <td className="font-mono">{e.regularHours}</td>
                                    <td className="font-mono text-red-600 font-semibold">{e.overtimeHours}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* NBOT Report */}
            {activeReport === "nbot" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(nbot?.totals || []).map((t) => (
                            <div key={t.employee?.id} className="card p-4">
                                <div className="font-medium text-sm">{t.employee?.name}</div>
                                <div className="text-2xl font-bold text-purple-600">{t.totalHours.toFixed(1)}</div>
                                <div className="text-xs text-gray-400">NBOT hrs</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Seniority Report */}
            {activeReport === "seniority" && (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>#</th><th>Name</th><th>Rank</th><th>Hire Date</th><th>Years of Service</th><th>Shift</th><th>Contracted Hrs</th></tr></thead>
                        <tbody>
                            {seniority.map((e, i) => {
                                const years = e.hireDate ? ((new Date() - new Date(e.hireDate)) / (365.25 * 86400000)).toFixed(1) : "—";
                                return (
                                    <tr key={e.id}>
                                        <td className="font-bold text-gray-400">{i + 1}</td>
                                        <td className="font-medium">{e.name}</td>
                                        <td>{e.rank}</td>
                                        <td>{e.hireDate ? format(new Date(e.hireDate), "MMM d, yyyy") : "—"}</td>
                                        <td className="font-mono">{years}</td>
                                        <td>{e.shift || "—"}</td>
                                        <td><span className={`badge ${e.contractedWeeklyHours <= 32 ? "badge-blue" : "badge-gray"}`}>{e.contractedWeeklyHours}hr</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Credentials Expiry */}
            {activeReport === "credentials" && (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Employee</th><th>License #</th><th>Expiry Date</th><th>Status</th><th>Guard Card #</th></tr></thead>
                        <tbody>
                            {creds.map((c) => {
                                const expired = c.licenseExpiry && new Date(c.licenseExpiry) < new Date();
                                const expiringSoon = c.licenseExpiry && !expired && new Date(c.licenseExpiry) < new Date(Date.now() + 60 * 86400000);
                                return (
                                    <tr key={c.id} className={expired ? "bg-red-50" : expiringSoon ? "bg-amber-50" : ""}>
                                        <td className="font-medium">{c.employee?.name}</td>
                                        <td className="font-mono text-xs">{c.licenseNumber || "—"}</td>
                                        <td className={expired ? "text-red-600 font-semibold" : expiringSoon ? "text-amber-600 font-semibold" : ""}>
                                            {c.licenseExpiry ? format(new Date(c.licenseExpiry), "MMM d, yyyy") : "—"}
                                        </td>
                                        <td>
                                            {expired && <span className="badge badge-red">Expired</span>}
                                            {expiringSoon && !expired && <span className="badge badge-yellow">Expiring Soon</span>}
                                            {!expired && !expiringSoon && <span className="badge badge-green">Current</span>}
                                        </td>
                                        <td className="font-mono text-xs">{c.guardCardNumber || "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
