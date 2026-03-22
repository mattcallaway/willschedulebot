import axios from "axios";

const api = axios.create({
    baseURL: "/api",
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("wsb_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// On 401, clear token and reload to login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("wsb_token");
            localStorage.removeItem("wsb_user");
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);

export default api;

// ── Typed helpers ─────────────────────────────────────────────────────────

// Auth
export const login = (email, password) =>
    api.post("/auth/login", { email, password }).then((r) => r.data);

// Employees
export const getEmployees = (params) => api.get("/employees", { params }).then((r) => r.data);
export const getEmployee = (id) => api.get(`/employees/${id}`).then((r) => r.data);
export const createEmployee = (data) => api.post("/employees", data).then((r) => r.data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data).then((r) => r.data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`).then((r) => r.data);
export const getCredentials = (id) => api.get(`/employees/${id}/credentials`).then((r) => r.data);
export const updateCredentials = (id, data) => api.put(`/employees/${id}/credentials`, data).then((r) => r.data);

// Schedules
export const getSchedule = (week) => api.get("/schedules", { params: { week } }).then((r) => r.data);
export const snapSchedule = (weekStart, changeNote) =>
    api.post("/schedules/snapshot", { weekStart, changeNote }).then((r) => r.data);

// Shifts
export const getShifts = (params) => api.get("/shifts", { params }).then((r) => r.data);
export const createShift = (data) => api.post("/shifts", data).then((r) => r.data);
export const updateShift = (id, data) => api.put(`/shifts/${id}`, data).then((r) => r.data);
export const deleteShift = (id) => api.delete(`/shifts/${id}`).then((r) => r.data);
export const assignShift = (id, data) => api.post(`/shifts/${id}/assign`, data).then((r) => r.data);
export const reassignShift = (shiftId, assignmentId, data) =>
    api.put(`/shifts/${shiftId}/assignments/${assignmentId}`, data).then((r) => r.data);

// Leave
export const getLeaveRequests = (params) => api.get("/leave", { params }).then((r) => r.data);
export const createLeave = (data) => api.post("/leave", data).then((r) => r.data);
export const updateLeave = (id, data) => api.put(`/leave/${id}`, data).then((r) => r.data);
export const deleteLeave = (id) => api.delete(`/leave/${id}`).then((r) => r.data);

// Ledger
export const getPtoLedger = (empId) => api.get(`/ledger/pto/${empId}`).then((r) => r.data);
export const getSickLedger = (empId) => api.get(`/ledger/sick/${empId}`).then((r) => r.data);
export const adjustBalance = (data) => api.post("/ledger/adjust", data).then((r) => r.data);
export const triggerAccrual = (data) => api.post("/ledger/accrue", data).then((r) => r.data);

// Overtime / NBOT
export const getOvertime = (params) => api.get("/overtime", { params }).then((r) => r.data);
export const getNbot = (params) => api.get("/nbot", { params }).then((r) => r.data);

// Coverage
export const getRecommendations = (params) => api.get("/coverage/recommend", { params }).then((r) => r.data);

// Recurring templates
export const getTemplates = (params) => api.get("/recurring", { params }).then((r) => r.data);
export const createTemplate = (data) => api.post("/recurring", data).then((r) => r.data);
export const updateTemplate = (id, data) => api.put(`/recurring/${id}`, data).then((r) => r.data);
export const deleteTemplate = (id) => api.delete(`/recurring/${id}`).then((r) => r.data);
export const generateFromTemplate = (id, weekStart) =>
    api.post(`/recurring/${id}/generate`, { weekStart }).then((r) => r.data);

// Reports
export const getHoursReport = (params) => api.get("/reports/hours", { params }).then((r) => r.data);
export const getPtoReport = () => api.get("/reports/pto").then((r) => r.data);
export const getSickReport = () => api.get("/reports/sick").then((r) => r.data);
export const getOvertimeReport = (params) => api.get("/reports/overtime", { params }).then((r) => r.data);
export const getNbotReport = (params) => api.get("/reports/nbot", { params }).then((r) => r.data);
export const getSeniorityReport = () => api.get("/reports/seniority").then((r) => r.data);
export const getCredentialsReport = (params) => api.get("/reports/credentials", { params }).then((r) => r.data);

// Settings
export const getSettings = () => api.get("/settings").then((r) => r.data);
export const updateSetting = (key, value) => api.put(`/settings/${key}`, { value }).then((r) => r.data);

// Audit
export const getAuditLogs = (params) => api.get("/audit", { params }).then((r) => r.data);

// Import
export const importRoster = (file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/import/roster", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
