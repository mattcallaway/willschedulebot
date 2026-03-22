import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import EmployeeDirectory from "./pages/EmployeeDirectory.jsx";
import EmployeeProfile from "./pages/EmployeeProfile.jsx";
import Scheduler from "./pages/Scheduler.jsx";
import RecurringSchedules from "./pages/RecurringSchedules.jsx";
import LeaveManager from "./pages/LeaveManager.jsx";
import LedgerView from "./pages/LedgerView.jsx";
import OvertimeNbot from "./pages/OvertimeNbot.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

function PrivateRoute({ children }) {
    const token = localStorage.getItem("wsb_token");
    return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/"
                element={
                    <PrivateRoute>
                        <Layout />
                    </PrivateRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="employees" element={<EmployeeDirectory />} />
                <Route path="employees/:id" element={<EmployeeProfile />} />
                <Route path="scheduler" element={<Scheduler />} />
                <Route path="schedules/recurring" element={<RecurringSchedules />} />
                <Route path="leave" element={<LeaveManager />} />
                <Route path="ledger/:employeeId" element={<LedgerView />} />
                <Route path="overtime" element={<OvertimeNbot />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
