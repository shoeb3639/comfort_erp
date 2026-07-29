import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createTenantUser,
  getLocations,
  getSetupErrorMessage,
  getTenantRoles,
  getTenantUsers,
  updateTenantUser,
} from "../../services/tenantSetup";
import {
  fieldClass,
  formatDateTime,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
} from "./accessUtils";

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      password: "",
      roleId: "",
      locationId: "",
      status: "ACTIVE",
    },
  });

  async function load() {
    const [userData, roleData, locationData] = await Promise.all([
      getTenantUsers(),
      getTenantRoles(),
      getLocations(),
    ]);
    setUsers(userData);
    setRoles(roleData);
    setLocations(locationData);
  }

  useEffect(() => {
    load().catch((requestError) =>
      setError(getSetupErrorMessage(requestError)),
    );
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        [user.name, user.email, user.mobile, user.role.name, user.status]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [search, users],
  );

  async function addUser(values) {
    setError("");
    try {
      await createTenantUser({
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
        roleId: values.roleId,
        locationIds: values.locationId ? [values.locationId] : [],
        status: values.status,
      });
      reset();
      await load();
    } catch (requestError) {
      setError(getSetupErrorMessage(requestError));
    }
  }

  async function changeStatus(user, status) {
    setError("");
    try {
      await updateTenantUser(user.id, { status });
      await load();
    } catch (requestError) {
      setError(getSetupErrorMessage(requestError));
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Users" value={users.length} />
        <SummaryCard
          label="Active Users"
          value={users.filter((user) => user.status === "ACTIVE").length}
        />
        <SummaryCard
          label="Roles Assigned"
          value={new Set(users.map((user) => user.role.id)).size}
        />
        <SummaryCard label="Locations" value={locations.length} />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Section title="Add Tenant User">
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={handleSubmit(addUser)}
        >
          <label>
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              className={fieldClass}
              {...register("name", { required: true })}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className={fieldClass}
              type="email"
              {...register("email", { required: true })}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Mobile</span>
            <input className={fieldClass} {...register("mobile")} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">
              Temporary Password
            </span>
            <input
              className={fieldClass}
              type="password"
              minLength={12}
              {...register("password", { required: true })}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              className={fieldClass}
              {...register("roleId", { required: true })}
            >
              <option value="">Select role</option>
              {roles
                .filter((role) => role.status === "ACTIVE")
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Location</span>
            <select className={fieldClass} {...register("locationId")}>
              <option value="">No location</option>
              {locations
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select className={fieldClass} {...register("status")}>
              <option>ACTIVE</option>
              <option>PENDING_ACTIVATION</option>
              <option>INACTIVE</option>
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Create User
            </button>
          </div>
        </form>
      </Section>
      <Section
        title="Tenant User List"
        actions={
          <input
            className={`${fieldClass} mt-0 sm:w-72`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
          />
        }
      >
        <TableShell
          columns={[
            "User",
            "Role",
            "Locations",
            "Status",
            "Last Login",
            "Created",
          ]}
          empty={filteredUsers.length === 0}
        >
          {filteredUsers.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">
                  {user.name}
                  {user.isPrimaryOwner ? " (Owner)" : ""}
                </p>
                <p className="text-slate-500">
                  {user.email} {user.mobile ? `| ${user.mobile}` : ""}
                </p>
              </td>
              <td className="px-4 py-3 text-slate-600">{user.role.name}</td>
              <td className="px-4 py-3 text-slate-600">
                {user.locations.map((row) => row.location.name).join(", ") ||
                  "—"}
              </td>
              <td className="px-4 py-3">
                {user.isPrimaryOwner ? (
                  <StatusBadge status={user.status} />
                ) : (
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    value={user.status}
                    onChange={(event) => changeStatus(user, event.target.value)}
                  >
                    <option>ACTIVE</option>
                    <option>INACTIVE</option>
                    <option>SUSPENDED</option>
                  </select>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatDateTime(user.lastLoginAt)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatDateTime(user.createdAt)}
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  );
}

export default UsersPage;
