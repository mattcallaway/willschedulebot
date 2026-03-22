import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Users, Calendar, RefreshCw,
    Plane, BookOpen, Clock, BarChart2, Settings, LogOut, Shield,
} from "lucide-react";

const nav = [
    { to: "/", label: "Dashboard", Icon: LayoutDashboard },
    { to: "/employees", label: "Employees", Icon: Users },
    { to: "/scheduler", label: "Scheduler", Icon: Calendar },
    { to: "/schedules/recurring", label: "Recurring Schedules", Icon: RefreshCw },
    { to: "/leave", label: "Leave / Outages", Icon: Plane },
    { to: "/overtime", label: "Overtime & NBOT", Icon: Clock },
    { to: "/reports", label: "Reports", Icon: BarChart2 },
    { to: "/settings", label: "Settings", Icon: Settings },
];

export default function Layout() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("wsb_user") || "{}");

    function logout() {
        localStorage.removeItem("wsb_token");
        localStorage.removeItem("wsb_user");
        navigate("/login");
    }

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <Shield size={24} className="text-brand-100" />
                    <div>
                        <div className="font-bold text-sm leading-tight">WillScheduleBot</div>
                        <div className="text-brand-300 text-xs">Workforce Management</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {nav.map(({ to, label, Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === "/"}
                            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="px-5 py-4 border-t border-brand-700">
                    <div className="text-xs text-brand-300 mb-1 truncate">{user.email}</div>
                    <button onClick={logout} className="nav-item w-full justify-start text-red-300 hover:text-red-200 hover:bg-red-900/30">
                        <LogOut size={16} />
                        <span>Log out</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 ml-60 min-h-screen">
                <div className="max-w-screen-xl mx-auto px-6 py-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
