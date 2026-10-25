import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ScreenHeader } from '../layout/ScreenHeader'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { minPasswordLength, useAuth } from './useAuth'

/** Écran ouvert par le lien du courriel : la session est déjà là, on choisit le nouveau mot de passe. */
export function PasswordScreen() {
  const { session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < minPasswordLength) {
      setError(`Le mot de passe doit faire au moins ${minPasswordLength} caractères.`)
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.')
      return
    }
    setPending(true)
    const result = await updatePassword(password)
    setPending(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  const toggle = (
    <button
      type="button"
      className="flex size-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
      onClick={() => setShow((v) => !v)}
      aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      {show ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  )

  return (
    <>
      <ScreenHeader title="Nouveau mot de passe" back="/reglages" />
      <div className="flex flex-col gap-6 px-5 pb-8">
        {done ? (
          <>
            <p role="status" className="rounded-md bg-ok-tint px-4 py-3 text-sm font-semibold text-ok">
              Mot de passe changé. Il sert dès maintenant sur tous tes appareils.
            </p>
            <Button onClick={() => navigate('/', { replace: true })}>Revenir à l’accueil</Button>
          </>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <p className="text-ink-2">
              {session?.user.email ? `Pour ${session.user.email}. ` : null}
              {`Au moins ${minPasswordLength} caractères.`}
            </p>
            {/* Le courriel caché aide les gestionnaires de mots de passe à ranger le nouveau au bon compte. */}
            <input type="email" autoComplete="username" value={session?.user.email ?? ''} readOnly hidden />
            <Field
              label="Nouveau mot de passe"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={minPasswordLength}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={toggle}
            />
            <Field
              label="Confirmer le mot de passe"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error ? (
              <p role="alert" className="rounded-md bg-bad-tint px-4 py-3 text-sm font-semibold text-bad">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </Button>
          </form>
        )}
      </div>
    </>
  )
}
