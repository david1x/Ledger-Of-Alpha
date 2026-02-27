"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  email_verified: number;
  two_factor_enabled: number;
  is_admin: number;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users);
    else setError(data.error);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleAdmin(user: AdminUser) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: !user.is_admin }),
    });
    if (res.ok) load();
    else {
      const d = await res.json();
      alert(d.error);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Delete ${user.email}? This is irreversible.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const d = await res.json();
      alert(d.error);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold dark:text-white text-slate-900 mb-6">Users</h1>

      {loading && <p className="text-sm dark:text-slate-400 text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl overflow-hidden">

          {/* ── Mobile card view (< sm) ── */}
          <div className="sm:hidden divide-y dark:divide-slate-800 divide-slate-100">
            {users.map(user => {
              const initials = user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={user.id} className="p-4 space-y-3">
                  {/* Name + avatar + actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium dark:text-white text-slate-900 text-sm">{user.name}</span>
                          {!!user.is_admin && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Admin</span>
                          )}
                        </div>
                        <div className="dark:text-slate-400 text-slate-500 text-xs">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleAdmin(user)}
                        title={user.is_admin ? "Remove admin" : "Make admin"}
                        className="p-1.5 rounded-lg dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors dark:text-slate-400 text-slate-500">
                        {user.is_admin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteUser(user)}
                        title="Delete user"
                        className="p-1.5 rounded-lg dark:hover:bg-red-500/10 hover:bg-red-50 transition-colors text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Status badges + date */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {user.email_verified ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <UserCheck className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 dark:text-slate-500 text-slate-400">
                          <UserX className="w-3.5 h-3.5" /> Unverified
                        </span>
                      )}
                      {!!user.two_factor_enabled && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/50 dark:text-slate-400 text-slate-500">2FA</span>
                      )}
                    </div>
                    <span className="dark:text-slate-500 text-slate-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table (sm+) ── */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="border-b dark:border-slate-800 border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b dark:border-slate-800/50 border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                        {user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium dark:text-white text-slate-900">{user.name}</span>
                          {!!user.is_admin && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Admin</span>
                          )}
                        </div>
                        <div className="dark:text-slate-400 text-slate-500 text-xs">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {user.email_verified ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <UserCheck className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs dark:text-slate-500 text-slate-400">
                          <UserX className="w-3.5 h-3.5" /> Unverified
                        </span>
                      )}
                      {!!user.two_factor_enabled && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 dark:text-slate-400 text-slate-500">2FA</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleAdmin(user)}
                        title={user.is_admin ? "Remove admin" : "Make admin"}
                        className="p-1.5 rounded-lg dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors dark:text-slate-400 text-slate-500">
                        {user.is_admin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteUser(user)}
                        title="Delete user"
                        className="p-1.5 rounded-lg dark:hover:bg-red-500/10 hover:bg-red-50 transition-colors text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
