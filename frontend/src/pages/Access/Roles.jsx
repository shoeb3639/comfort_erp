import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createTenantRole,
  getSetupErrorMessage,
  getTenantPermissions,
  getTenantRoles,
  updateRolePermissions,
} from "../../services/tenantSetup";
import {
  fieldClass,
  PermissionKey,
  Section,
  StatusBadge,
  SummaryCard,
  SystemBadge,
  TableShell,
} from "./accessUtils";

function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState(new Set());
  const [error, setError] = useState("");
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: "", code: "", description: "", status: "ACTIVE" },
  });

  async function load(preferredRoleId) {
    const [roleData, permissionData] = await Promise.all([
      getTenantRoles(),
      getTenantPermissions(),
    ]);
    setRoles(roleData);
    setPermissions(permissionData);
    const roleId = preferredRoleId || selectedRoleId || roleData[0]?.id || "";
    setSelectedRoleId(roleId);
    const selected = roleData.find((role) => role.id === roleId);
    setSelectedPermissionIds(
      new Set(selected?.permissions.map((row) => row.permission.id) || []),
    );
  }

  useEffect(() => {
    load().catch((requestError) =>
      setError(getSetupErrorMessage(requestError)),
    );
  }, []);

  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const groupedPermissions = useMemo(
    () =>
      permissions.reduce((groups, permission) => {
        groups[permission.module] = [
          ...(groups[permission.module] || []),
          permission,
        ];
        return groups;
      }, {}),
    [permissions],
  );

  function selectRole(role) {
    setSelectedRoleId(role.id);
    setSelectedPermissionIds(
      new Set(role.permissions.map((row) => row.permission.id)),
    );
  }

  async function addRole(values) {
    setError("");
    try {
      const role = await createTenantRole({
        ...values,
        code: values.code.toUpperCase(),
        permissionIds: [],
      });
      reset();
      await load(role.id);
    } catch (requestError) {
      setError(getSetupErrorMessage(requestError));
    }
  }

  function togglePermission(permissionId) {
    if (selectedRole?.isSystemRole) return;
    setSelectedPermissionIds((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  async function savePermissions() {
    setError("");
    try {
      await updateRolePermissions(selectedRoleId, [...selectedPermissionIds]);
      await load(selectedRoleId);
    } catch (requestError) {
      setError(getSetupErrorMessage(requestError));
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Roles" value={roles.length} />
        <SummaryCard
          label="System Roles"
          value={roles.filter((role) => role.isSystemRole).length}
        />
        <SummaryCard
          label="Custom Roles"
          value={roles.filter((role) => !role.isSystemRole).length}
        />
        <SummaryCard label="Permission Keys" value={permissions.length} />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Section title="Add Custom Role">
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_180px]"
          onSubmit={handleSubmit(addRole)}
        >
          <label>
            <span className="text-sm font-medium text-slate-700">
              Role Name
            </span>
            <input
              className={fieldClass}
              {...register("name", { required: true })}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Code</span>
            <input
              className={fieldClass}
              {...register("code", { required: true })}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">
              Description
            </span>
            <input className={fieldClass} {...register("description")} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select className={fieldClass} {...register("status")}>
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-4">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Create Role
            </button>
          </div>
        </form>
      </Section>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Section title="Role List">
          <TableShell
            columns={["Role", "Code", "Type", "Users", "Status"]}
            empty={roles.length === 0}
            minWidth="760px"
          >
            {roles.map((role) => (
              <tr
                key={role.id}
                className={`cursor-pointer hover:bg-slate-50 ${selectedRoleId === role.id ? "bg-brand-50/60" : ""}`}
                onClick={() => selectRole(role)}
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{role.name}</p>
                  <p className="text-slate-500">{role.description}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{role.code}</td>
                <td className="px-4 py-3">
                  <SystemBadge enabled={role.isSystemRole} />
                </td>
                <td className="px-4 py-3">{role._count.users}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={role.status} />
                </td>
              </tr>
            ))}
          </TableShell>
        </Section>
        <Section
          title="Role Permissions"
          actions={
            selectedRole && !selectedRole.isSystemRole ? (
              <button
                className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white"
                onClick={savePermissions}
              >
                Save Permissions
              </button>
            ) : null
          }
        >
          {selectedRole?.isSystemRole && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              System role permissions are managed by Cablix and cannot be
              edited.
            </p>
          )}
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(
              ([module, modulePermissions]) => (
                <div
                  key={module}
                  className="rounded-xl border border-slate-200"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {module}
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {modulePermissions.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex gap-3 px-4 py-3"
                      >
                        <input
                          className="mt-1 h-4 w-4"
                          type="checkbox"
                          disabled={selectedRole?.isSystemRole}
                          checked={selectedPermissionIds.has(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">
                            {permission.action}
                          </span>
                          <span className="mt-1 block">
                            <PermissionKey value={permission.permissionKey} />
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

export default RolesPage;
