import { getMockData } from '../../services/api'
import { Section, StatusBadge, SummaryCard, TableShell, formatDate } from './platformUtils'

function PlatformUsersPage() {
  const users = getMockData('platformUsers')

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Platform Users" value={users.length} />
        <SummaryCard label="Active Users" value={users.filter((item) => item.status === 'ACTIVE').length} tone="success" />
        <SummaryCard label="User Scope" value="PLATFORM" caption="Separate from tenant users" />
      </div>

      <Section title="Platform User List" subtitle="Cablix administrators only. Tenant owner and employee users are managed inside Tenant ERP.">
        <TableShell columns={['Name', 'Email', 'Mobile', 'Role', 'Status', 'Last Login', 'Created']} minWidth="900px" empty={users.length === 0}>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{user.name}</td>
              <td className="px-4 py-3 text-slate-700">{user.email}</td>
              <td className="px-4 py-3 text-slate-700">{user.mobile}</td>
              <td className="px-4 py-3 text-slate-700">{user.role}</td>
              <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
              <td className="px-4 py-3 text-slate-700">{formatDate(user.last_login)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDate(user.created_at)}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default PlatformUsersPage
