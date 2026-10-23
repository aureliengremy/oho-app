import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Navigate, useLocation } from 'react-router'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { useAuth } from './AuthProvider'

export function LoginScreen() {
  const { status, signInWithPassword, sendMagicLink } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState<'password' | 'link' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)

  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending('password')
    const result = await signInWithPassword(email, password)
    setPending(null)
    if (result.error) setError(result.error)
  }

  async function onMagicLink() {
    setError(null)
    if (!email.trim()) {
      setError('Écris ton courriel pour recevoir le lien.')
      return
    }
    setPending('link')
    const result = await sendMagicLink(email)
    setPending(null)
    if (result.error) setError(result.error)
    else setLinkSentTo(email.trim())
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-6 pt-[max(48px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col justify-center gap-8">
        <header className="flex flex-col gap-2">
          <Brand className="text-6xl" />
          <p className="font-display text-xl text-ink-2">Nos outils, à deux.</p>
          <p className="text-ink-3">Courses, voyages, soirées télé et dépenses, au même endroit.</p>
        </header>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Field
            label="Courriel"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />
          <p className="text-sm text-ink-3">Tu restes connecté sur cet appareil jusqu’à ce que tu te déconnectes.</p>

          {error ? (
            <p role="alert" className="rounded-md bg-bad-tint px-4 py-3 text-sm font-semibold text-bad">
              {error}
            </p>
          ) : null}
          {linkSentTo ? (
            <p role="status" className="rounded-md bg-ok-tint px-4 py-3 text-sm font-semibold text-ok">
              Lien envoyé à {linkSentTo}. Ouvre-le sur ce téléphone pour te connecter.
            </p>
          ) : null}

          <Button type="submit" disabled={pending !== null}>
            {pending === 'password' ? 'Connexion…' : 'Se connecter'}
          </Button>
          <div className="flex items-center gap-3 text-ink-4" aria-hidden="true">
            <span className="h-px flex-1 bg-rule" />
            <span className="font-mono text-xs">OU</span>
            <span className="h-px flex-1 bg-rule" />
          </div>
          <Button variant="secondary" onClick={onMagicLink} disabled={pending !== null}>
            <Mail size={18} aria-hidden="true" />
            {pending === 'link' ? 'Envoi…' : 'Recevoir un lien par courriel'}
          </Button>
        </form>
      </div>
      <p className="flex items-center justify-center gap-2 pt-8 text-sm text-ink-3">
        <Lock size={14} aria-hidden="true" /> Espace privé · pas d’inscription libre
      </p>
    </main>
  )
}
