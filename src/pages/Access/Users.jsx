import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createMockRecord, getMockData } from '../../services/api'
import { fieldClass, formatDateTime, Section, StatusBadge, SummaryCard, TableShell } from './accessUtils'

function UsersPage() {
  const [users, setUsers] = useState(() => getMockData('users'))
  const roles = useMemo(() => getMockData('roles'), [])
  const locations = useMemo(() => getMockData('locations'), [])
  const [search, setSearch] = useState('')
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: '',
      email: '',
      mobile: '',
      role_id: 'ROLE-004',
      branch_id: 'LOC-001',
      status: 'Active',
    },
  })

  const roleById = Object.fromEntries(roles.map((role) => [role.id, role]))
  const locationById = Object.fromEntries(locations.map((location) => [location.id, location]))
  const filteredUsers = users.filter((user) => {
    const role = roleById[user.role_id]
    return [user.name, user.email, user.mobile, role?.name, user.status].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  })

  function addUser(values) {
    const user = {
      id: `USR-${String(Date.now()).slice(-6)}`,
      name: values.name,
      email: values.email,
      mobile: values.mobile,
      role_id: values.role_id,
      branch_ids: [values.branch_id].filter(Boolean),
      status: values.status,
      last_login: '',
      created_at: new Date().toISOString(),
    }

    createMockRecord('users', user)
    setUsers((currentUsers) => [user, ...currentUsers])
    reset()
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Users" value={users.length} />
        <SummaryCard label="Active Users" value={users.filter((user) => user.status === 'Active').length} />
        <SummaryCard label="Roles Assigned" value={new Set(users.map((user) => user.role_id)).size} />
        <SummaryCard label="Branches" value={locations.length} />
      </div>

      <Section title="Add User">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleSubmit(addUser)}>
          <label>
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input className={fieldClass} {...register('name', { required: true })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input className={fieldClass} type="email" {...register('email', { required: true })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Mobile</span>
            <input className={fieldClass} {...register('mobile', { required: true })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select className={fieldClass} {...register('role_id')}>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select className={fieldClass} {...register('branch_id')}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select className={fieldClass} {...register('status')}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Create User</button>
          </div>
        </form>
      </Section>

      <Section
        title="User List"
        actions={<input className={`${fieldClass} mt-0 sm:w-72`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" />}
      >
        <TableShell columns={['User', 'Role', 'Branches', 'Status', 'Last Login', 'Created']} empty={filteredUsers.length === 0}>
          {filteredUsers.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{user.name}</p>
                <p className="text-slate-500">{user.email} | {user.mobile}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{roleById[user.role_id]?.name || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{(user.branch_ids || []).map((id) => locationById[id]?.name || id).join(', ') || '-'}</td>
              <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
              <td className="px-4 py-3 text-slate-600">{formatDateTime(user.last_login)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDateTime(user.created_at)}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default UsersPage
