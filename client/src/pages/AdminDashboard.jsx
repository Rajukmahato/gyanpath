import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import Input from '../components/ui/Input.jsx'

const ROLE_TONE = { student: 'neutral', instructor: 'brand', moderator: 'warning', admin: 'danger' }
const STATUS_TONE = { success: 'success', failure: 'danger', approved: 'success', rejected: 'danger' }

const TABS = [
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'audit', label: 'Audit log', Icon: Activity },
]

function ConfirmDeleteDialog({ user, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-ink-900">Delete account?</h3>
        <p className="mt-2 text-sm text-ink-500">
          Permanently delete <span className="font-medium text-ink-900">{user.email}</span> and all their enrollments, certificates, and sessions. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white border-red-600">Delete</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function UsersTab() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [pending, setPending] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [changingRole, setChangingRole] = useState(null)

  async function load(p = page) {
    const params = { page: p, limit: 20 }
    if (search) params.search = search
    if (roleFilter) params.role = roleFilter
    const result = await api.adminListUsers(params)
    setData(result)
  }

  useEffect(() => { load(1); setPage(1) }, [search, roleFilter])
  useEffect(() => { load(page) }, [page])

  async function handleDelete() {
    await api.adminDeleteUser(confirmDelete._id)
    setConfirmDelete(null)
    load(page)
  }

  async function handleRoleChange(userId, role) {
    setPending(userId)
    try {
      await api.adminChangeRole(userId, role)
      load(page)
    } finally {
      setPending('')
      setChangingRole(null)
    }
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <Input
            className="pl-9"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-ink-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">All roles</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {data?.users.map((u) => (
                <tr key={u._id} className="hover:bg-ink-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900">{u.profile?.name || '—'}</div>
                    <div className="text-xs text-ink-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {changingRole === u._id ? (
                      <select
                        defaultValue={u.role}
                        disabled={pending === u._id}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none"
                        autoFocus
                        onBlur={() => setChangingRole(null)}
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setChangingRole(u._id)}
                        className="flex items-center gap-1 group"
                        title="Click to change role"
                      >
                        <Badge tone={ROLE_TONE[u.role]} className="capitalize">{u.role}</Badge>
                        <Shield className="h-3 w-3 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.emailVerified
                        ? <Badge tone="success" className="text-[10px]">verified</Badge>
                        : <Badge tone="warning" className="text-[10px]">unverified</Badge>}
                      {u.mfaEnabled && <Badge tone="brand" className="text-[10px]">2FA</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setConfirmDelete(u)}
                      className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
            <span className="text-xs text-ink-400">{data.total} users total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-ink-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {confirmDelete && (
        <ConfirmDeleteDialog
          user={confirmDelete}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function AuditTab() {
  const [actionFilter, setActionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)

  async function load(p = page) {
    const params = { page: p, limit: 50 }
    if (actionFilter) params.action = actionFilter
    if (statusFilter) params.status = statusFilter
    const result = await api.adminAuditLogs(params)
    setData(result)
  }

  useEffect(() => { load(1); setPage(1) }, [actionFilter, statusFilter])
  useEffect(() => { load(page) }, [page])

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Filter by action (e.g. login)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="flex-1 min-w-40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-mono">
              {data?.logs.map((log) => (
                <tr key={log._id} className="hover:bg-ink-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-ink-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-700 max-w-[140px] truncate" title={log.actor}>
                    {log.actor}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold text-ink-800">{log.action}</span>
                    {log.role && <span className="ml-1 text-ink-400 text-[10px]">({log.role})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">
                    {log.resourceType}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-400">{log.ip || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[log.status] || 'neutral'} className="text-[10px] capitalize">
                      {log.status || '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
            <span className="text-xs text-ink-400">{data.total} events total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-ink-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('users')

  return (
    <Layout>
      <Container className="max-w-5xl py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink-900">Admin dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">Manage users, review audit events, and monitor platform activity.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-ink-200 bg-ink-50 p-1 w-fit">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && <UsersTab />}
        {tab === 'audit' && <AuditTab />}
      </Container>
    </Layout>
  )
}
