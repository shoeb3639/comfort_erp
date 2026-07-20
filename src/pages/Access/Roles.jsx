import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createMockRecord, getMockData } from '../../services/api'
import { fieldClass, PermissionKey, Section, StatusBadge, SummaryCard, SystemBadge, TableShell } from './accessUtils'

function RolesPage() {
  const [roles, setRoles] = useState(() => getMockData('roles'))
  const permissions = useMemo(() => getMockData('permissions'), [])
  const rolePermissions = useMemo(() => getMockData('rolePermissions'), [])
  const [selectedRoleId, setSelectedRoleId] = useState('ROLE-001')
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: '',
      code: '',
      description: '',
      status: 'Active',
    },
  })

  const selectedPermissionIds = new Set(rolePermissions.filter((row) => row.role_id === selectedRoleId).map((row) => row.permission_id))
  const groupedPermissions = permissions.reduce((groups, permission) => {
    groups[permission.module] = [...(groups[permission.module] || []), permission]
    return groups
  }, {})

  function addRole(values) {
    const role = {
      id: `ROLE-${String(Date.now()).slice(-6)}`,
      name: values.name,
      code: values.code,
      description: values.description,
      is_system_role: false,
      status: values.status,
    }

    createMockRecord('roles', role)
    setRoles((currentRoles) => [role, ...currentRoles])
    reset()
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Roles" value={roles.length} />
        <SummaryCard label="System Roles" value={roles.filter((role) => role.is_system_role).length} />
        <SummaryCard label="Active Roles" value={roles.filter((role) => role.status === 'Active').length} />
        <SummaryCard label="Permission Keys" value={permissions.length} />
      </div>

      <Section title="Add Custom Role">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_180px]" onSubmit={handleSubmit(addRole)}>
          <label>
            <span className="text-sm font-medium text-slate-700">Role Name</span>
            <input className={fieldClass} placeholder="Branch Auditor" {...register('name', { required: true })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Code</span>
            <input className={fieldClass} placeholder="branch_auditor" {...register('code', { required: true })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Description</span>
            <input className={fieldClass} {...register('description')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select className={fieldClass} {...register('status')}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-4">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Create Role</button>
          </div>
        </form>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Section title="Role List">
          <TableShell columns={['Role', 'Code', 'Type', 'Status']} empty={roles.length === 0} minWidth="760px">
            {roles.map((role) => (
              <tr key={role.id} className={`cursor-pointer hover:bg-slate-50 ${selectedRoleId === role.id ? 'bg-brand-50/60' : ''}`} onClick={() => setSelectedRoleId(role.id)}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{role.name}</p>
                  <p className="text-slate-500">{role.description}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{role.code}</td>
                <td className="px-4 py-3"><SystemBadge enabled={role.is_system_role} /></td>
                <td className="px-4 py-3"><StatusBadge status={role.status} /></td>
              </tr>
            ))}
          </TableShell>
        </Section>

        <Section title="Role Permissions">
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <div key={module} className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{module}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {modulePermissions.map((permission) => (
                    <label key={permission.id} className="flex gap-3 px-4 py-3">
                      <input className="mt-1 h-4 w-4 rounded border-slate-300" type="checkbox" checked={selectedPermissionIds.has(permission.id)} readOnly />
                      <span>
                        <span className="block font-semibold text-slate-900">{permission.action}</span>
                        <span className="mt-1 block"><PermissionKey value={permission.permission_key} /></span>
                        <span className="mt-1 block text-sm text-slate-500">{permission.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

export default RolesPage
