import { useState } from 'react'
import { Eye, EyeSlash, Lock, SpinnerGap, User } from '@phosphor-icons/react'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

type LoginProps = {
  onLogin?: () => void
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    if (!trimmedUsername || !trimmedPassword) {
      setError('Veuillez saisir votre identifiant et votre mot de passe.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
        }),
      })

      if (!response.ok) {
        throw new Error('Identifiants invalides')
      }

      onLogin?.()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Connexion impossible'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-page">
        {/* Section Visuelle (Fond flyover + branding Madagascar) */}
        <div className="auth-visual">
          <div className="auth-visual__overlay" />
          <div className="auth-visual__content">
            <div className="auth-visual__brand">
              <img src="/republiquemdg.png" alt="République de Madagascar" />
            </div>

            <p className="auth-visual__motto">
              « Bâtir les infrastructures de demain pour le développement de Madagascar »
            </p>
          </div>
        </div>

        {/* Carte / Panneau de connexion (style rounded card comme Image 2) */}
        <div className="auth-panel">
          <div className="auth-panel__inner">
            {/* Logo MTP sur desktop */}
            <div className="auth-panel__brand">
              <img src="/logomtp.png" alt="Logo MTP" />
            </div>

            <div className="auth-header-group">
              <h1 className="auth-title">Connexion</h1>
              <p className="auth-subtitle">Identifiant ou email</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <div className="auth-field-wrapper">
                <div className="auth-input-pill">
                  <span className="auth-input-icon">
                    <User size={19} weight="bold" />
                  </span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Identifiant ou email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                  />
                </div>
              </div>

              <div className="auth-field-wrapper">
                <div className="auth-input-pill">
                  <span className="auth-input-icon">
                    <Lock size={19} weight="bold" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mot de passe"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
                  </button>
                </div>

                <div className="auth-forgot-row">
                  <a href="#" onClick={(event) => event.preventDefault()} className="auth-forgot-link">
                    Mot de passe oublié ?
                  </a>
                </div>
              </div>

              <button type="submit" className="auth-submit-pill" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <SpinnerGap size={20} className="spin" />
                    <span>Connexion...</span>
                  </>
                ) : (
                  <span>Se connecter</span>
                )}
              </button>
            </form>

            <div className="auth-panel__footer">
              <span>Ministère des Travaux Publics • République de Madagascar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

