import { useEffect, useMemo, useState } from "react";
import {
  getSetupErrorMessage,
  getTenantPermissions,
  getTenantRoles,
} from "../../services/tenantSetup";
import {
  fieldClass,
  PermissionKey,
  Section,
  SummaryCard,
  TableShell,
} from "./accessUtils";

function PermissionsPage() {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [moduleFilter, setModuleFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getTenantPermissions(), getTenantRoles()])
      .then(([permissionData, roleData]) => {
        setPermissions(permissionData);
        setRoles(roleData);
      })
      .catch((requestError) => setError(getSetupErrorMessage(requestError)));
  }, []);

  const modules = useMemo(
    () => [
      "All",
      ...new Set(permissions.map((permission) => permission.module)),
    ],
    [permissions],
  );
  const filteredPermissions = permissions.filter((permission) => {
    const matchesModule =
      moduleFilter === "All" || permission.module === moduleFilter;
    return (
      matchesModule &&
      [
        permission.module,
        permission.action,
        permission.permissionKey,
        permission.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );
  });
  const assignments = roles.reduce(
    (total, role) => total + role.permissions.length,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Permissions" value={permissions.length} />
        <SummaryCard label="Modules" value={modules.length - 1} />
        <SummaryCard label="Roles" value={roles.length} />
        <SummaryCard label="Assignments" value={assignments} />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Section
        title="Permission Catalog"
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              className={`${fieldClass} mt-0 sm:w-56`}
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
            >
              {modules.map((module) => (
                <option key={module}>{module}</option>
              ))}
            </select>
            <input
              className={`${fieldClass} mt-0 sm:w-72`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search permission keys"
            />
          </div>
        }
      >
        <TableShell
          columns={[
            "Module",
            "Action",
            "Permission Key",
            "Description",
            "Assigned Roles",
          ]}
          empty={filteredPermissions.length === 0}
        >
          {filteredPermissions.map((permission) => (
            <tr key={permission.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-900">
                {permission.module}
              </td>
              <td className="px-4 py-3 text-slate-600">{permission.action}</td>
              <td className="px-4 py-3">
                <PermissionKey value={permission.permissionKey} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {permission.description || "—"}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {permission._count.roles}
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  );
}

export default PermissionsPage;
