import { useEffect, useState } from "react";
import {
  getPlatformErrorMessage,
  getPlatformUsers,
} from "../../services/platform";
import {
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  formatDate,
} from "./platformUtils";

function PlatformUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPlatformUsers()
      .then((records) => active && setUsers(records))
      .catch((requestError) => active && setError(getPlatformErrorMessage(requestError)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Platform Users" value={users.length} caption={loading ? "Loading…" : "Persisted users"} />
        <SummaryCard label="Active Users" value={users.filter((item) => item.status === "ACTIVE").length} tone="success" />
        <SummaryCard label="User Scope" value="PLATFORM" caption="Separate from tenant users" />
      </div>
      <Section title="Platform User List" subtitle="Cablix administrators stored in the platform user directory.">
        <TableShell columns={["Name", "Email", "Mobile", "Role", "Status", "Last Login", "Created"]} minWidth="900px" empty={!loading && users.length === 0}>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{user.name}</td>
              <td className="px-4 py-3 text-slate-700">{user.email}</td>
              <td className="px-4 py-3 text-slate-700">{user.mobile || "-"}</td>
              <td className="px-4 py-3 text-slate-700">{user.role?.name || user.designation || "-"}</td>
              <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
              <td className="px-4 py-3 text-slate-700">{formatDate(user.lastLoginAt)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDate(user.createdAt)}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  );
}

export default PlatformUsersPage;
