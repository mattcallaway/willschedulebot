import { useQuery } from "@tanstack/react-query";
import { getEmployees, getSchedule, getLeaveRequests, getOvertimeReport, getNbotReport } from "../api/client.js";
import { Users, Calendar, Plane, Clock, AlertTriangle, Award } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { Link } from "react-router-dom";

function StatCard({ icon: Icon, label, value, sub, color = "bg-brand-100 text-brand-600" }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${color}`}><Icon size={22} /></div>
            <div>
                <div className="stat-value">{value ?? "—"}</div>
                <div className="stat-label">{label}</div>
                {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");

    const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => getEmployees({ active: "true" }) });
    const { data: schedule } = useQuery({ queryKey: ["schedule", weekStart], queryFn: () => getSchedule(weekStart) });
    const { data: leaveList = [] } = useQuery({ queryKey: ["leave-upcoming"], queryFn: () => getLeaveRequests({ status: "approved" }) });
    const { data: ot = [] } = useQuery({ queryKey: ["ot-report"], queryFn: () => getOvertimeReport({ from: weekStart }) });
    const { data: nbot } = useQuery({ queryKey: ["nbot-report"], queryFn: () => getNbotReport({ from: weekStart }) });

    const totalShifts = schedule
        ? Object.values(schedule.schedule || {}).reduce((sum, day) => sum + day.length, 0)
        : 0;
    const openShifts = schedule
        ? Object.values(schedule.schedule || {}).reduce(
            (sum, day) => sum + day.filter((s) => s.isOpen).length,
            0
        )
        : 0;
    const upcomingLeave = leaveList.filter((l) => new Date(l.startDate) >= new Date()).length;
    const totalNbot = (nbot?.totals || []).reduce((sum, t) => sum + t.totalHours, 0);

    // Upcoming week days
    const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(weekStart), i));

    // 32hr vs 40hr split
    const hr32 = employees.filter((e) => e.contractedWeeklyHours <= 32).length;
    const hr40 = employees.filter((e) => e.contractedWeeklyHours > 32).length;

    return (
        <div>
            <h1 className="page-header">Dashboard</h1>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <StatCard icon={Users} label="Active Employees" value={employees.length} sub={`${hr32} × 32hr  •  ${hr40} × 40hr`} color="bg-blue-100 text-blue-600" />
                <StatCard icon={Calendar} label="Shifts This Week" value={totalShifts} sub={openShifts > 0 ? `${openShifts} open` : "All covered"} color={openShifts ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"} />
                <StatCard icon={Plane} label="Upcoming Leave" value={upcomingLeave} sub="approved requests" color="bg-purple-100 text-purple-600" />
                <StatCard icon={Clock} label="NBOT Hrs This Period" value={totalNbot.toFixed(1)} sub="current pay period" color="bg-rose-100 text-rose-600" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Weekly overview */}
                <div className="card xl:col-span-2">
                    <div className="card-header flex items-center justify-between">
                        <span>Week of {weekStart}</span>
                        <Link to="/scheduler" className="text-sm text-brand-600 hover:underline">Open Scheduler →</Link>
                    </div>
                    <div className="card-body p-0">
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        {days.map((d) => (
                                            <th key={d.toISOString()} className="text-center">
                                                <div>{format(d, "EEE")}</div>
                                                <div className="font-normal text-gray-400">{format(d, "M/d")}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {days.map((d) => {
                                            const key = format(d, "yyyy-MM-dd");
                                            const dayShifts = schedule?.schedule?.[key] || [];
                                            return (
                                                <td key={key} className="text-center align-top">
                                                    <div className="text-sm font-semibold text-gray-700">{dayShifts.length}</div>
                                                    <div className="text-xs text-gray-400">shifts</div>
                                                    {dayShifts.filter((s) => s.isOpen).length > 0 && (
                                                        <span className="badge-yellow mt-1">{dayShifts.filter((s) => s.isOpen).length} open</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Upcoming leave */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <span>Upcoming Leave</span>
                        <Link to="/leave" className="text-sm text-brand-600 hover:underline">View all →</Link>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {leaveList.slice(0, 6).map((l) => (
                            <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-800">{l.employee?.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {format(new Date(l.startDate), "MMM d")} – {format(new Date(l.endDate), "MMM d")} · {l.hours}h
                                    </div>
                                </div>
                                <span className={`badge ${l.type === "pto" ? "badge-blue" : l.type === "sick" ? "badge-red" : "badge-gray"}`}>
                                    {l.type}
                                </span>
                            </div>
                        ))}
                        {leaveList.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No upcoming leave</div>}
                    </div>
                </div>
            </div>

            {/* OT summary */}
            {ot.length > 0 && (
                <div className="card mt-6">
                    <div className="card-header flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={16} />
                        Overtime This Period
                    </div>
                    <div className="card-body p-0">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Regular Hrs</th>
                                    <th>Overtime Hrs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ot.map((e) => (
                                    <tr key={e.id}>
                                        <td>{e.employee?.name}</td>
                                        <td>{e.regularHours}</td>
                                        <td className="text-red-600 font-semibold">{e.overtimeHours}</td>
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
