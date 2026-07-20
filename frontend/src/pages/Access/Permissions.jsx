import { useMemo, useState } from 'react'
import { getMockData } from '../../services/api'
import { fieldClass, PermissionKey, Section, SummaryCard, TableShell } from './accessUtils'

function PermissionsPage() {
  const permissions = useMemo(() => getMockData('permissions'), [])
  const rolePermissions = useMemo(() => getMockData('rolePermissions'), [])
  const roles = useMemo(() => getMockData('roles'), [])
  const [moduleFilter, setModuleFilter] = useState('All')
  const [search, setSearch] = useState('')
  const modules = ['All', ...Array.from(new Set(permissions.map((permission) => permission.module)))]
  const filteredPermissions = permissions.filter((permission) => {
    const matchesModule = moduleFilter === 'All' || permission.module === moduleFilter
    const searchableText = [permission.module, permission.action, permission.permission_key, permission.description].join(' ').toLowerCase()
    return matchesModule && searchableText.includes(search.trim().toLowerCase())
  })

  function getRoleCount(permissionId) {
    return new Set(rolePermissions.filter((row) => row.permission_id === permissionId).map((row) => row.role_id)).size
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Permissions" value={permissions.length} />
        <SummaryCard label="Modules" value={modules.length - 1} />
        <SummaryCard label="Roles" value={roles.length} />
        <SummaryCard label="Assignments" value={rolePermissions.length} />
      </div>

      <Section
        title="Permission Catalog"
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <select className={`${fieldClass} mt-0 sm:w-56`} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
              {modules.map((module) => <option key={module}>{module}</option>)}
            </select>
            <input className={`${fieldClass} mt-0 sm:w-72`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search permission keys" />
          </div>
        }
      >
        <TableShell columns={['Module', 'Action', 'Permission Key', 'Description', 'Assigned Roles']} empty={filteredPermissions.length === 0}>
          {filteredPermissions.map((permission) => (
            <tr key={permission.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-900">{permission.module}</td>
              <td className="px-4 py-3 text-slate-600">{permission.action}</td>
              <td className="px-4 py-3"><PermissionKey value={permission.permission_key} /></td>
              <td className="px-4 py-3 text-slate-600">{permission.description}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{getRoleCount(permission.id)}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default PermissionsPage
