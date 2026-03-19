"use client";
import { useEffect, useState } from "react";
import { Users, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import type { AdminUser } from "@/components/settings/types";

interface Props {
  isAdmin: boolean;
}

export default function AdminUsersTab({ isAdmin }: Props) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");

  const loadAdminUsers = async () => {
    setAdminUsersLoading(true);
    setAdminUsersError("");
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setAdminUsers(data.users);
    else setAdminUsersError(data.error);
    setAdminUsersLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadAdminUsers();
  }, [isAdmin]);

  const toggleAdminRole = async (user: AdminUser) => {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: !user.is_admin }),
    });
    if (res.ok) loadAdminUsers();
    else {
      const d = await res.json();
      alert(d.error);
    }
  };

  const deleteAdminUser = async (user: AdminUser) => {
    if (!confirm(`Delete ${user.email}? This is irreversible.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) loadAdminUsers();
    else {
      const d = await res.json();
      alert(d.error);
    }
  };

  return (
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <Users className="w-4 h-4 text-emerald-400" /> User Management
      </h2>

      {adminUsersLoading && (
        <p className="text-sm dark:text-slate-400 text-slate-500">Loading...</p>
      )}
      {adminUsersError && <p className="text-sm text-red-400">{adminUsersError}</p>}

      {!adminUsersLoading && !adminUsersError && adminUsers.length > 0 && (
        <div className="border dark:border-slate-700 border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-slate-700 border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">
                  User
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                  Joined
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                  Status
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b dark:border-slate-700/50 border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold shrink-0">
                        {user.name
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium dark:text-white text-slate-900 text-sm">
                            {user.name}
                          </span>
                          {!!user.is_admin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="dark:text-slate-400 text-slate-500 text-xs">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-xs hidden sm:table-cell">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 dark:text-slate-400 text-slate-500">
                          2FA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleAdminRole(user)}
                        title={user.is_admin ? "Remove admin" : "Make admin"}
                        className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors dark:text-slate-400 text-slate-500"
                      >
                        {user.is_admin ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteAdminUser(user)}
                        title="Delete user"
                        className="p-1.5 rounded-lg hover:dark:bg-red-500/10 hover:bg-red-50 transition-colors text-red-400"
                      >
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
    </section>
  );
}
