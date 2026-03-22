import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchedule, createShift, getRecommendations, assignShift } from "../api/client.js";
import { format, startOfWeek, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Zap, Filter } from "lucide-react";
import toast from "react-hot-toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RANK_OPTIONS = [
    { value: "", label: "All Ranks" },
    { value: "APO", label: "APO only" },
    { value: "HPO", label: "HPO only" },
    { value: "PSS", label: "PSS only" },
];

const RANK_COLORS = {
    APO: "shift-chip-regular",
    HPO: "shift-chip-cover",
    PSS: "shift-chip-nbot",
};

export default function Scheduler() {
    const qc = useQueryClient();
    const [weekStart, setWeekStart] = useState(() =>
        format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd")
    );
    const [rankFilter, setRankFilter] = useState("");
    const [selectedShift, setSelectedShift] = useState(null);

    const { data: schedule, isLoading } = useQuery({
        queryKey: ["schedule", weekStart],
        queryFn: () => getSchedule(weekStart),
    });

    const { data: recommendations } = useQuery({
        queryKey: ["recommend", selectedShift?.id],
        queryFn: () =>
            getRecommendations({
                date: selectedShift?.date?.slice(0, 10),
                shiftId: selectedShift?.id,
                startTime: selectedShift?.startTime,
                endTime: selectedShift?.endTime,
                durationHrs: selectedShift?.durationHrs,
            }),
        enabled: !!selectedShift,
    });

    const assignMut = useMutation({
        mutationFn: ({ shiftId, employeeId, reason }) =>
            assignShift(shiftId, { employeeId, type: "cover", recommendedReason: reason }),
        onSuccess: () => {
            toast.success("Shift assigned");
            qc.invalidateQueries({ queryKey: ["schedule", weekStart] });
            setSelectedShift(null);
        },
        onError: (e) => toast.error(e.response?.data?.error || "Assignment failed"),
    });

    function prevWeek() {
        setWeekStart((w) => format(addDays(new Date(w), -7), "yyyy-MM-dd"));
        setSelectedShift(null);
    }
    function nextWeek() {
        setWeekStart((w) => format(addDays(new Date(w), 7), "yyyy-MM-dd"));
        setSelectedShift(null);
    }

    const days = Array.from({ length: 7 }, (_, i) =>
        format(addDays(new Date(weekStart), i), "yyyy-MM-dd")
    );

    /** Filter a day's shifts by selected rank */
    function filterShifts(shifts) {
        if (!rankFilter) return shifts;
        return shifts.filter((s) =>
            s.assignments?.some((a) => a.employee?.rank === rankFilter) ||
            (s.isOpen && !rankFilter)
        );
    }

    /** Count total visible shifts across the week */
    const totalVisible = days.reduce((sum, d) => {
        const dayShifts = filterShifts(schedule?.schedule?.[d] || []);
        return sum + dayShifts.length;
    }, 0);

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                    <h1 className="page-header mb-0">Weekly Scheduler</h1>
                    {!isLoading && (
                        <p className="text-sm text-gray-400 mt-0.5">
                            {totalVisible} shift{totalVisible !== 1 ? "s" : ""}
                            {rankFilter ? ` · ${rankFilter} only` : " · all ranks"}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Rank filter */}
                    <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                        <Filter size={14} className="text-gray-400" />
                        {RANK_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setRankFilter(opt.value)}
                                className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors ${rankFilter === opt.value
                                        ? "bg-brand-600 text-white"
                                        : "text-gray-500 hover:bg-gray-100"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Week nav */}
                    <button onClick={prevWeek} className="btn-outline p-2"><ChevronLeft size={18} /></button>
                    <span className="text-sm font-medium w-44 text-center">Week of {weekStart}</span>
                    <button onClick={nextWeek} className="btn-outline p-2"><ChevronRight size={18} /></button>
                </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {days.map((d, i) => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
                        {DAYS[i]} <span className="font-normal">{format(new Date(d + "T00:00:00"), "M/d")}</span>
                    </div>
                ))}
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">Loading schedule…</div>
            ) : (
                <div className="grid grid-cols-7 gap-1">
                    {days.map((d) => {
                        const dayShifts = filterShifts(schedule?.schedule?.[d] || []);
                        return (
                            <div key={d} className="sched-cell min-h-[120px] flex flex-col gap-1">
                                {dayShifts.map((shift) => {
                                    const assignment = shift.assignments?.[0];
                                    const rank = assignment?.employee?.rank;
                                    const isOpen = shift.isOpen || !assignment;
                                    const chipClass = isOpen
                                        ? "shift-chip-open"
                                        : assignment?.isNbot
                                            ? "shift-chip-nbot"
                                            : RANK_COLORS[rank] || "shift-chip-regular";

                                    return (
                                        <div
                                            key={shift.id}
                                            className={chipClass}
                                            title={`${shift.startTime}–${shift.endTime}${rank ? ` · ${rank}` : ""}`}
                                            onClick={() => setSelectedShift(shift)}
                                        >
                                            <div className="font-semibold truncate text-xs">
                                                {shift.startTime}–{shift.endTime}
                                            </div>
                                            <div className="truncate text-xs opacity-80">
                                                {assignment?.employee?.name || "Open"}
                                            </div>
                                            {rank && (
                                                <span className={`text-[10px] font-bold opacity-60`}>{rank}</span>
                                            )}
                                            {assignment?.willCreateOvertime && (
                                                <span className="text-xs text-amber-600">⚠ OT</span>
                                            )}
                                        </div>
                                    );
                                })}
                                <button
                                    onClick={() => { }}
                                    className="mt-auto text-xs text-gray-300 hover:text-brand-400 flex items-center gap-1 px-1"
                                >
                                    <Plus size={12} /> Add shift
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Coverage Recommendation panel */}
            {selectedShift && (
                <div className="mt-6 card">
                    <div className="card-header flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Zap size={16} className="text-amber-400" /> Coverage Recommendations
                        </span>
                        <button onClick={() => setSelectedShift(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
                    </div>
                    <div className="card-body">
                        <p className="text-sm text-gray-500 mb-4">
                            Shift: {selectedShift.label || ""} · {selectedShift.startTime}–{selectedShift.endTime} · {format(new Date(selectedShift.date), "MMM d")}
                        </p>
                        {!recommendations && <div className="text-gray-400 text-sm">Loading recommendations…</div>}
                        {recommendations?.eligible?.length === 0 && (
                            <div className="text-gray-400 text-sm">No eligible employees available for this shift.</div>
                        )}
                        <div className="space-y-2">
                            {recommendations?.eligible?.map((r, i) => (
                                <div
                                    key={r.employee.id}
                                    className={`flex items-start justify-between p-3 rounded-lg border ${i === 0 ? "border-brand-300 bg-brand-50" : "border-gray-100 bg-white"
                                        }`}
                                >
                                    <div>
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            {i === 0 && <Zap size={14} className="text-amber-400" />}
                                            {r.employee.name}
                                            <span className={`badge ${r.employee.rank === "APO" ? "badge-blue" : "badge-gray"}`}>
                                                {r.employee.rank}
                                            </span>
                                            {r.employee.contractedWeeklyHours <= 32 && <span className="badge badge-yellow">32hr</span>}
                                        </div>
                                        <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                                            {r.reasons.map((rea, j) => <li key={j}>• {rea}</li>)}
                                        </ul>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {r.willCreateOvertime && <span className="badge badge-yellow">⚠ OT risk</span>}
                                        <button
                                            className="btn-primary text-xs py-1"
                                            onClick={() =>
                                                assignMut.mutate({
                                                    shiftId: selectedShift.id,
                                                    employeeId: r.employee.id,
                                                    reason: r.reasons.join("; "),
                                                })
                                            }
                                            disabled={assignMut.isPending}
                                        >
                                            Assign
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
