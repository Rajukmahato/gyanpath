import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { startRegistration } from '@simplewebauthn/browser'
import { Camera, Download, FileDown, FileUp, Fingerprint, KeyRound, Plus, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { api, setAccessToken, getAccessToken, API_URL } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import Input, { Label, Textarea, PasswordInput } from '../components/ui/Input.jsx'
import Alert from '../components/ui/Alert.jsx'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'

function ConfirmDialog({ title, message, danger, onConfirm, onCancel, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
        <p className="mt-2 text-sm text-ink-600">{message}</p>
        {children}
        <div className="mt-5 flex gap-3">
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={onConfirm}>
            {danger ? 'Yes, delete' : 'Confirm'}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function PasskeysCard() {
  const [passkeys, setPasskeys] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function load() {
    api.listPasskeys().then(setPasskeys).catch(() => {})
  }
  useEffect(load, [])

  async function addPasskey() {
    setError(null)
    setBusy(true)
    try {
      const options = await api.passkeyRegisterOptions()
      const attestation = await startRegistration({ optionsJSON: options })
      await api.passkeyRegisterVerify({ attestation, name: `Passkey ${new Date().toLocaleDateString()}` })
      load()
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') return // user cancelled
      setError(err.body?.error || err.message || 'Could not add passkey.')
    } finally {
      setBusy(false)
    }
  }

  async function removePasskey(id) {
    await api.deletePasskey(id)
    load()
  }

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-display font-semibold text-ink-900">
            <Fingerprint className="h-4 w-4 text-brand-600" /> Passkeys
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Sign in without a password using your fingerprint, face, or device PIN (WebAuthn/FIDO2).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addPasskey} disabled={busy}>
          <Plus className="h-3.5 w-3.5" /> {busy ? 'Waiting…' : 'Add passkey'}
        </Button>
      </div>

      {error && <Alert tone="error" className="mt-3">{error}</Alert>}

      {passkeys.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-100">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2 text-ink-700">
                <Fingerprint className="h-4 w-4 text-ink-400" />
                {p.name}
                <span className="text-xs text-ink-400">· added {new Date(p.createdAt).toLocaleDateString()}</span>
              </span>
              <button
                onClick={() => removePasskey(p.id)}
                className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Remove passkey"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const mismatch = confirm.length > 0 && next !== confirm

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg(null)
    if (next !== confirm) {
      setMsg({ tone: 'error', text: 'New passwords do not match.' })
      return
    }
    setBusy(true)
    try {
      const res = await api.changePassword({ currentPassword: current, newPassword: next })
      // the server rotates our session — keep the returned access token so we stay signed in
      if (res.accessToken) setAccessToken(res.accessToken)
      setCurrent(''); setNext(''); setConfirm('')
      setMsg({ tone: 'success', text: 'Password changed. Your other devices have been signed out.' })
    } catch (err) {
      setMsg({ tone: 'error', text: err.body?.reasons?.join(', ') || err.body?.error || 'Could not change password.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6 p-6">
      <p className="flex items-center gap-2 font-display font-semibold text-ink-900">
        <KeyRound className="h-4 w-4 text-brand-600" /> Change password
      </p>
      <p className="mt-1 text-sm text-ink-500">
        Update your password. For your security this signs out all your other devices.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div>
          <Label>Current password</Label>
          <PasswordInput required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <Label>New password</Label>
          <PasswordInput required value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <PasswordStrengthMeter password={next} />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <PasswordInput
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={mismatch ? 'border-red-400' : ''}
          />
          {mismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>}
        </div>
        <Button type="submit" disabled={busy || mismatch || !current || !next}>
          {busy ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </Card>
  )
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user.profile?.name || '')
  const [bio, setBio] = useState(user.profile?.bio || '')
  const [interests, setInterests] = useState((user.profile?.interests || []).join(', '))
  const [language, setLanguage] = useState(user.profile?.language || 'en')
  const [message, setMessage] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileRef = useRef(null)
  const importRef = useRef(null)

  const initials = (user.profile?.name || user.email).slice(0, 2).toUpperCase()

  // dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMfaDisable, setShowMfaDisable] = useState(false)
  const [mfaDisableCode, setMfaDisableCode] = useState('')
  const [mfaDisableError, setMfaDisableError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    const interestList = interests.split(',').map((s) => s.trim()).filter(Boolean)
    await api.updateProfile({ profile: { name, bio, interests: interestList, language } })
    setMessage({ tone: 'success', text: 'Profile updated.' })
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    const form = new FormData()
    form.append('avatar', file)
    const res = await fetch(`${API_URL}/api/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: form,
    })
    const data = await res.json()
    if (data.avatarUrl) {
      setAvatarUrl(data.avatarUrl)
      await refreshUser() // update the global user so the nav avatar updates too
    }
    setAvatarLoading(false)
  }

  async function handleExport() {
    // server returns a PDF — fetch raw and trigger download
    const res = await fetch(`${API_URL}/api/users/me/export`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gyanpath-my-data.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportJson() {
    // machine-readable export that the import below can consume (data portability)
    const res = await fetch(`${API_URL}/api/users/me/export.json`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gyanpath-my-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const result = await api.importMyData({ profile: parsed.profile })
      // reflect the restored fields in the form immediately — older exports nested the
      // editable fields under profile.profile, so unwrap that shape here too
      const p = parsed.profile?.profile && typeof parsed.profile.profile === 'object'
        ? parsed.profile.profile
        : parsed.profile
      if (p?.name != null) setName(p.name)
      if (p?.bio != null) setBio(p.bio)
      if (p?.interests) setInterests(p.interests.join(', '))
      if (p?.language) setLanguage(p.language)
      await refreshUser()
      setMessage({ tone: 'success', text: `Imported: ${result.imported.join(', ')}.` })
    } catch (err) {
      setMessage({ tone: 'error', text: err.body?.error || 'Could not import this file — expected a GyanPath JSON export.' })
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  async function handleDeleteAccount() {
    await api.deleteAccount()
    setAccessToken(null)
    navigate('/')
  }

  async function handleMfaDisable(e) {
    e.preventDefault()
    setMfaDisableError(null)
    try {
      await api.disableMfa({ token: mfaDisableCode })
      setShowMfaDisable(false)
      setMfaDisableCode('')
      window.location.reload() // reload so user.mfaEnabled updates
    } catch (err) {
      setMfaDisableError(err.body?.error || 'Invalid code')
    }
  }

  return (
    <Layout>
      <Container className="max-w-2xl py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900">Profile</h1>

        {/* Avatar */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md ring-2 ring-brand-200 transition hover:ring-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            aria-label="Change profile photo"
          >
            {avatarUrl ? (
              <img src={`${API_URL}${avatarUrl}`} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-brand-100 font-display text-3xl font-bold text-brand-700">
                {initials}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {avatarLoading
                ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                : <Camera className="h-6 w-6 text-white" />}
            </span>
          </button>
          <p className="text-xs text-ink-400">Click to change photo · max 3 MB</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <Card className="mt-4 p-6">
          <form onSubmit={handleSave} className="space-y-4">
            {message && <Alert tone={message.tone}>{message.text}</Alert>}
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled className="bg-ink-50 text-ink-400" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div>
              <Label>Interests</Label>
              <Input placeholder="loksewa, coding, design" value={interests} onChange={(e) => setInterests(e.target.value)} />
              <p className="mt-1 text-xs text-ink-400">Comma-separated.</p>
            </div>
            <div>
              <Label>Preferred language</Label>
              <select
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="ne">नेपाली</option>
              </select>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        {/* Two-factor authentication */}
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-display font-semibold text-ink-900">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Two-factor authentication
              </p>
              <p className="mt-1 text-sm text-ink-500">Add a second layer of security with an authenticator app.</p>
            </div>
            {user.mfaEnabled ? (
              <div className="flex items-center gap-2">
                <Badge tone="success">Enabled</Badge>
                <Button variant="outline" size="sm" onClick={() => setShowMfaDisable(true)}>
                  <ShieldOff className="h-3.5 w-3.5" /> Disable
                </Button>
              </div>
            ) : (
              <Button as={Link} to="/mfa-setup" variant="outline">Set up</Button>
            )}
          </div>
        </Card>

        {/* Change password */}
        <ChangePasswordCard />

        {/* Passkeys (WebAuthn) */}
        <PasskeysCard />

        {/* Your data */}
        <Card className="mt-6 p-6">
          <p className="font-display font-semibold text-ink-900">Your data</p>
          <p className="mt-1 text-sm text-ink-500">
            Download a copy of your account data (right to portability), re-import your saved preferences, or permanently delete your account.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export as PDF
            </Button>
            <Button variant="outline" onClick={handleExportJson}>
              <FileDown className="h-4 w-4" /> Export as JSON
            </Button>
            <Button variant="outline" onClick={() => importRef.current?.click()}>
              <FileUp className="h-4 w-4" /> Import data
            </Button>
            <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} />
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" /> Delete account
            </Button>
          </div>
        </Card>
      </Container>

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete your account?"
          message="This will permanently delete your account, all enrollments, and certificates. This cannot be undone."
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* MFA disable confirmation — requires a valid TOTP code */}
      {showMfaDisable && (
        <ConfirmDialog
          title="Disable two-factor authentication?"
          message="Enter the 6-digit code from your authenticator app to confirm."
          onConfirm={() => {}}
          onCancel={() => { setShowMfaDisable(false); setMfaDisableCode(''); setMfaDisableError(null) }}
        >
          <form onSubmit={handleMfaDisable} className="mt-3 space-y-2">
            <Input
              placeholder="123456"
              value={mfaDisableCode}
              onChange={(e) => setMfaDisableCode(e.target.value)}
              maxLength={6}
              className="tracking-widest text-center"
              autoFocus
            />
            {mfaDisableError && <p className="text-xs text-red-600">{mfaDisableError}</p>}
            <Button type="submit" className="w-full" disabled={mfaDisableCode.length !== 6}>
              Confirm disable
            </Button>
          </form>
        </ConfirmDialog>
      )}
    </Layout>
  )
}
