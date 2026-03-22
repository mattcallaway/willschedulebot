import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting } from "../api/client.js";
import { useState } from "react";
import { Save } from "lucide-react";
import toast from "react-hot-toast";

export default function Settings() {
    const qc = useQueryClient();
    const { data: settings = [], isLoading } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
    const [edits, setEdits] = useState({});

    const saveMut = useMutation({
        mutationFn: async () => {
            const proms = Object.entries(edits).map(([key, value]) => updateSetting(key, value));
            await Promise.all(proms);
        },
        onSuccess: () => { toast.success("Settings saved"); setEdits({}); qc.invalidateQueries({ queryKey: ["settings"] }); },
        onError: (e) => toast.error(e.response?.data?.error || "Save failed"),
    });

    const groups = settings.reduce((acc, s) => {
        const g = s.group || "general";
        if (!acc[g]) acc[g] = [];
        acc[g].push(s);
        return acc;
    }, {});

    const groupLabels = { overtime: "Overtime Rules", accrual: "Accrual Rates", nbot: "NBOT Settings", general: "General" };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-header mb-0">Settings & Business Rules</h1>
                <button className="btn-primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || Object.keys(edits).length === 0}>
                    <Save size={16} /> {saveMut.isPending ? "Saving…" : "Save Changes"}
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">These settings define the core business rules for scheduling, accruals, and overtime. All changes are audit-logged.</p>

            {isLoading && <div className="text-gray-400">Loading settings…</div>}

            {Object.entries(groups).map(([group, items]) => (
                <div key={group} className="card mb-6">
                    <div className="card-header">{groupLabels[group] || group}</div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map((s) => (
                                <div key={s.key}>
                                    <label className="label">{s.label || s.key}</label>
                                    <input
                                        className="input"
                                        value={edits[s.key] ?? s.value}
                                        onChange={(e) => setEdits((ed) => ({ ...ed, [s.key]: e.target.value }))}
                                    />
                                    <p className="text-xs text-gray-400 mt-1 font-mono">{s.key}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}

            {settings.length === 0 && !isLoading && (
                <div className="text-gray-400 text-center py-12">No settings found. Run the seed script to populate default settings.</div>
            )}
        </div>
    );
}
