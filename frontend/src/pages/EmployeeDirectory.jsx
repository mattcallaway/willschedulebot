import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployees, importRoster } from "../api/client.js";
import { Link } from "react-router-dom";
import { UserPlus, Upload, Search, Users } from "lucide-react";
import toast from "react-hot-toast";

export default function EmployeeDirectory() {
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [shift, setShift] = useState("");

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["employees", search, status, shift],
        queryFn: () => getEmployees({ search: search || undefined, status: status || undefined, shift: shift || undefined }),
    });

    const importMut = useMutation({
        mutationFn: (file) => importRoster(file),
        onSuccess: (data) => {
            toast.success(`Import complete: ${data.created} created, ${data.updated} updated`);
            qc.invalidateQueries({ queryKey: ["employees"] });
        },
        onError: (e) => toast.error(e.response?.data?.error || "Import failed"),
    });

    function handleFileImport(e) {
        const file = e.target.files?.[0];
        if (file) importMut.mutate(file);
        e.target.value = "";
    }

    const hr32 = employees.filter((e) => e.contractedWeeklyHours <= 32).length;
    const hr40 = employees.filter((e) => e.contractedWeeklyHours > 32).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-header mb-1">Employee Directory</h1>
                    <p className="text-sm text-gray-500">{employees.length} employees · {hr32} × 32hr · {hr40} × 40hr</p>
                </div>
                <div className="flex gap-3">
                    <label className="btn-outline cursor-pointer">
                        <Upload size={16} />
                        {importMut.isPending ? "Importing…" : "Import Roster"}
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileImport} />
                    </label>
                    <Link to="/employees/new" className="btn-primary">
                        <UserPlus size={16} /> Add Employee
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="input pl-9 w-56"
                        placeholder="Search name, ID, rank…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Leave</option>
                </select>
                <select className="input w-32" value={shift} onChange={(e) => setShift(e.target.value)}>
                    <option value="">All Shifts</option>
                    <option>Day</option>
                    <option>Night</option>
                    <option>Swing</option>
                </select>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>NUID</th>
                            <th>Rank</th>
                            <th>Shift</th>
                            <th>Contracted Hrs</th>
                            <th>Status</th>
                            <th>PTO Bal</th>
                            <th>Sick Bal</th>
                            <th>Hire Date</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading…</td></tr>
                        )}
                        {!isLoading && employees.length === 0 && (
                            <tr><td colSpan={10} className="text-center py-10 text-gray-400">No employees found</td></tr>
                        )}
                        {employees.map((emp) => (
                            <tr key={emp.id}>
                                <td className="font-medium text-gray-900">{emp.name}</td>
                                <td className="text-gray-500 text-xs">{emp.nuid || "—"}</td>
                                <td>{emp.rank || "—"}</td>
                                <td>{emp.shift || "—"}</td>
                                <td>
                                    <span className={`badge ${emp.contractedWeeklyHours <= 32 ? "badge-blue" : "badge-gray"}`}>
                                        {emp.contractedWeeklyHours}hr
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${emp.status === "Active" ? "badge-green" : "badge-gray"}`}>
                                        {emp.status || "—"}
                                    </span>
                                </td>
                                <td className="font-mono text-sm">{emp.ptoBalance?.toFixed(1)}</td>
                                <td className="font-mono text-sm">{emp.sickBalance?.toFixed(1)}</td>
                                <td className="text-xs text-gray-500">
                                    {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : "—"}
                                </td>
                                <td>
                                    <Link to={`/employees/${emp.id}`} className="text-brand-600 hover:underline text-sm">
                                        View →
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
