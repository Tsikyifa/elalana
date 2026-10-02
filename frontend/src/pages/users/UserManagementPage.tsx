import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Key, Plus, ShieldCheck, Trash, UserPlus, UsersThree } from '@phosphor-icons/react'
import { createUserManagement, deleteUserManagement, fetchCurrentUser, fetchUserManagement } from '../../api/users.api'
import type { UserAccount, UserRoleOption } from '../../api/users.api'

const ACTIVE_ROLE_NAMES = ['admin', 'chef_de_projet', 'drtp', 'visiteur'] as const

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  chef_de_projet: 'Chef de projet',
  drtp: 'DRTP',
  visiteur: 'Visiteur',
}

const normalizeRoleName = (roleName?: string | null) => {
  const value = (roleName ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  if (!value) return null

  if (ACTIVE_ROLE_NAMES.includes(value as typeof ACTIVE_ROLE_NAMES[number])) {
    return value
  }

  const aliases: Record<string, string> = {
    superadmin: 'admin',
    administrateur: 'admin',
    administration: 'admin',
    chef_projet: 'chef_de_projet',
    project_manager: 'chef_de_projet',
    gestionnaire_de_reference: 'drtp',
    gestionnaire_reference: 'drtp',
    viewer: 'visiteur',
    visiteur_ministre: 'visiteur',
    visiteur_sg: 'visiteur',
    visiteur_dgtp: 'visiteur',
    audience_ministre: 'visiteur',
    audience_op: 'visiteur',
  }

  return aliases[value] ?? null
}

const EMPTY_FORM = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'chef_de_projet',
}

export function UserManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [roles, setRoles] = useState<UserRoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchUserManagement()
      const normalizedUsers = res.users.map((user) => ({
        ...user,
        roles: Array.from(new Set((user.roles ?? []).map((role) => normalizeRoleName(role)).filter((role): role is string => Boolean(role)))),
      }))

      setUsers(normalizedUsers)
      setRoles(res.roles
        .map((role) => ({ ...role, name: normalizeRoleName(role.name) ?? role.name }))
        .filter((role) => role.name !== null && ACTIVE_ROLE_NAMES.includes(role.name as typeof ACTIVE_ROLE_NAMES[number])))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les utilisateurs.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      try {
        const me = await fetchCurrentUser()
        setCurrentUserId(me.user.id)
      } catch {
        setCurrentUserId(null)
      }

      await loadUsers()
    }

    void initialize()
  }, [])

  const roleOptions = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles],
  )

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        term.length === 0 ||
        user.username.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.first_name?.toLowerCase().includes(term) ||
        user.last_name?.toLowerCase().includes(term) ||
        user.roles.some((role) => role.toLowerCase().includes(term))

      const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter)

      return matchesSearch && matchesRole
    })
  }, [roleFilter, searchTerm, users])

  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter((user) => user.is_active).length
    const withRole = users.filter((user) => user.roles.length > 0).length
    const superUsers = users.filter((user) => user.is_superuser || user.is_staff).length
    const roleCounts = new Map<string, number>()

    users.forEach((user) => {
      user.roles.forEach((role) => {
        roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
      })
    })

    const topRole = [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      total,
      active,
      withRole,
      superUsers,
      topRole,
    }
  }, [users])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const normalizedRole = normalizeRoleName(form.role) ?? form.role
      await createUserManagement({
        username: form.username,
        email: form.email || undefined,
        password: form.password,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        roles: normalizedRole ? [normalizedRole] : [],
      })

      setSuccess(`L’utilisateur ${form.username} a été créé avec le rôle ${ROLE_LABELS[normalizeRoleName(form.role) ?? form.role] ?? form.role}.`)
      setForm(EMPTY_FORM)
      setIsCreateModalOpen(false)
      await loadUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer l’utilisateur.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const closeModal = () => {
    setIsCreateModalOpen(false)
    setError(null)
    setSuccess(null)
    setForm(EMPTY_FORM)
  }

  const handleDeleteUser = async (userId: number, username: string) => {
    if (userId === currentUserId) {
      setError('Vous ne pouvez pas supprimer votre propre compte.')
      return
    }

    const confirmed = window.confirm(`Voulez-vous vraiment supprimer l’utilisateur ${username} ?`)
    if (!confirmed) return

    setDeletingUserId(userId)
    setError(null)
    setSuccess(null)

    try {
      await deleteUserManagement(userId)
      setSuccess(`L’utilisateur ${username} a été supprimé.`)
      await loadUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de supprimer l’utilisateur.'
      setError(message)
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24, padding: 24, color: 'var(--text)' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard label="Total" value={String(stats.total)} helper="Utilisateurs" icon={<UsersThree size={18} />} tone="var(--primary)" />
        <StatCard label="Actifs" value={String(stats.active)} helper="Comptes validés" icon={<ShieldCheck size={18} />} tone="var(--success)" />
        <StatCard label="Rôles" value={String(stats.withRole)} helper="Ayant un rôle" icon={<Key size={18} />} tone="var(--primary-hover)" />
        <StatCard label="Rôle principal" value={stats.topRole ? stats.topRole[0] : '—'} helper={stats.topRole ? `${stats.topRole[1]} utilisateur(s)` : 'Aucun rôle'} icon={<UserPlus size={18} />} tone="var(--warning)" />
      </div>

      <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UsersThree size={18} />
            <h3 style={{ margin: 0 }}>Utilisateurs existants</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Rechercher un utilisateur..."
                style={{
                  ...fieldStyle,
                  width: '100%',
                  minWidth: 200,
                }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              style={{
                ...fieldStyle,
                minWidth: 180,
                background: 'var(--panel)',
              }}
            >
              <option value="all">Tous les rôles</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.name}>{ROLE_LABELS[role.name] ?? role.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                background: 'var(--primary)',
                color: 'var(--on-primary)',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Plus size={16} />
              Nouveau utilisateur
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', padding: '12px 0' }}>Chargement des comptes…</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--muted)', background: 'var(--panel-soft)' }}>
            Aucun utilisateur correspondant au filtre.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'var(--panel-soft)', textAlign: 'left' }}>
                  <th style={tableHeaderStyle}>Utilisateur</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Rôle</th>
                  <th style={tableHeaderStyle}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ color: 'var(--text-strong)' }}>{user.username}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {user.first_name || 'Prénom'} {user.last_name || 'Nom'}
                        </span>
                      </div>
                    </td>
                    <td style={tableCellStyle}>{user.email || '—'}</td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(user.roles.length ? user.roles : ['Aucun rôle']).map((role) => {
                          const displayRole = role === 'Aucun rôle' ? 'Aucun rôle' : (ROLE_LABELS[role] ?? role)
                          return (
                            <span key={`${user.id}-${role}`} style={{ background: 'var(--accent-soft)', color: 'var(--primary-strong)', borderRadius: 999, padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {displayRole}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.76rem', background: user.is_active ? 'rgba(74, 222, 128, 0.18)' : 'var(--panel-muted)', color: user.is_active ? 'var(--success)' : 'var(--muted)', borderRadius: 999, padding: '5px 8px', fontWeight: 700 }}>
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </span>

                        {currentUserId !== user.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            disabled={deletingUserId === user.id}
                            style={{
                              background: deletingUserId === user.id ? 'rgba(248, 113, 113, 0.35)' : 'rgba(248, 113, 113, 0.12)',
                              color: 'var(--danger)',
                              border: '1px solid rgba(248, 113, 113, 0.35)',
                              borderRadius: 8,
                              padding: '7px 10px',
                              cursor: deletingUserId === user.id ? 'not-allowed' : 'pointer',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Trash size={14} />
                            {deletingUserId === user.id ? 'Supp...' : 'Supprimer'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && (
        <div style={{ color: 'var(--danger)', background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.28)', borderRadius: 12, padding: '10px 12px', marginTop: 8 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: 'var(--success)', background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.28)', borderRadius: 12, padding: '10px 12px', marginTop: 8 }}>
          {success}
        </div>
      )}

      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: 560, background: 'var(--panel)', borderRadius: 18, padding: 24, boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserPlus size={18} />
                <h3 style={{ margin: 0 }}>Créer un utilisateur</h3>
              </div>
              <button type="button" onClick={closeModal} style={{ border: 'none', background: 'var(--panel-muted)', color: 'var(--text-strong)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', fontWeight: 700 }}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Nom d’utilisateur</span>
                  <input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} required style={fieldStyle} />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Email</span>
                  <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} style={fieldStyle} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Prénom</span>
                  <input value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} style={fieldStyle} />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Nom</span>
                  <input value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} style={fieldStyle} />
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Mot de passe</span>
                <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} required style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Rôle</span>
                <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} style={fieldStyle}>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.name}>{ROLE_LABELS[role.name] ?? role.name}</option>
                  ))}
                </select>
              </label>

              {error && (
                <div style={{ color: 'var(--danger)', background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.28)', borderRadius: 12, padding: '10px 12px' }}>{error}</div>
              )}
              {success && (
                <div style={{ color: 'var(--success)', background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.28)', borderRadius: 12, padding: '10px 12px' }}>{success}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={closeModal} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving} style={{ background: 'var(--primary)', color: 'var(--on-primary)', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string
  helper: string
  icon: React.ReactNode
  tone: string
}

function StatCard({ label, value, helper, icon, tone }: StatCardProps) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ background: 'var(--panel-muted)', color: tone, borderRadius: 12, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-strong)' }}>{value}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 4 }}>{helper}</div>
    </div>
  )
}

const tableHeaderStyle: CSSProperties = {
  padding: '12px 14px',
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--muted)',
  fontWeight: 700,
}

const tableCellStyle: CSSProperties = {
  padding: '14px',
  color: 'var(--text)',
  verticalAlign: 'top',
}

const fieldStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: '0.96rem',
  background: 'var(--panel)',
  color: 'var(--text)',
}
