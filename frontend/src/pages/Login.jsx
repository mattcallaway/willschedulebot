import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client.js";
import { Shield } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await login(form.email, form.password);
            localStorage.setItem("wsb_token", data.token);
            localStorage.setItem("wsb_user", JSON.stringify(data.user));
            navigate("/");
        } catch (err) {
            toast.error(err.response?.data?.error || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
                        <Shield size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">WillScheduleBot</h1>
                    <p className="text-brand-100 mt-1">Workforce Management System</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Sign in</h2>

                    <div>
                        <label className="label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            required
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            placeholder="admin@willschedulebot.local"
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label className="label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="input"
                            required
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                        {loading ? "Signing in…" : "Sign in"}
                    </button>

                    <p className="text-xs text-center text-gray-400 mt-4">
                        Default: admin@willschedulebot.local / Admin1234!
                    </p>
                </form>
            </div>
        </div>
    );
}
