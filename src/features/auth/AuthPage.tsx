import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { ArrowUpRight, Plane, ShieldCheck, ArrowRight } from 'lucide-react'
import { useAuth } from './auth-context'
import { api } from '../../shared/api/client'
import { ErrorBox, Loading } from '../../shared/ui/primitives'
export function AuthPage() {
  const { user, loading, error, login } = useAuth()
  const [register, setRegister] = useState(false)
  const [done, setDone] = useState(false)
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: () => api<{ registrationEnabled: boolean; portalName: string }>('/public/config'),
  })
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (register) {
        await api('/auth/register', {
          method: 'POST',
          body: {
            email: data.get('email'),
            displayName: data.get('name'),
            password: data.get('password'),
          },
        })
        setDone(true)
      } else await login(String(data.get('email')), String(data.get('password')))
    },
  })
  if (loading) return <Loading />
  if (user) return <Navigate to="/" replace />
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Plane size={25} />
          </span>
          <span>
            BME PILOTS<small>CLASS OF 2026</small>
          </span>
        </a>
        <div className="auth-story-main">
          <span className="overline light">PROFESSIONAL PILOT · BUDAPEST</span>
          <h1>
            One class.
            <br />A shared heading.
          </h1>
          <p>
            Your next chapter starts here.
            <br />
            Updates, knowledge and your crew — all in one place.
          </p>
          <div className="flight-line">
            <span>BUD</span>
            <div>
              <i />
              <Plane size={24} />
              <i />
            </div>
            <span>2026</span>
          </div>
        </div>
        <div className="auth-bottom">
          <span>THE NEXT GENERATION OF PILOTS</span>
          <ArrowUpRight size={22} />
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">CREW ACCESS</span>
          <h2>{register ? 'Join the crew.' : 'Welcome aboard.'}</h2>
          <p className="muted">
            {register
              ? 'An administrator will review your application.'
              : 'Sign in to your class community portal.'}
          </p>
          <ErrorBox error={error ?? config.error} />
          {done ? (
            <div className="success" role="status">
              <ShieldCheck size={24} />
              <strong>Application submitted</strong>
              <p>
                If you applied with a new email address, your account is awaiting approval. You can
                sign in once it is activated.
              </p>
              <button
                className="button"
                onClick={() => {
                  setDone(false)
                  setRegister(false)
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate(new FormData(e.currentTarget))
              }}
            >
              <ErrorBox error={mutation.error} />
              {register && (
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="What should we call you?"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="name@example.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={register ? 12 : undefined}
                  maxLength={128}
                  required
                  placeholder={register ? 'At least 12 characters' : 'Your password'}
                />
              </label>
              <button
                className="button full"
                disabled={mutation.isPending || (register && !config.data?.registrationEnabled)}
              >
                {mutation.isPending ? 'One moment…' : register ? 'Submit application' : 'Sign in'}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          <div className="auth-switch">
            {register ? (
              <button
                onClick={() => {
                  setRegister(false)
                  mutation.reset()
                  setDone(false)
                }}
              >
                Already a member? Sign in
              </button>
            ) : config.data?.registrationEnabled ? (
              <button
                onClick={() => {
                  setRegister(true)
                  mutation.reset()
                }}
              >
                Not a member yet? Apply <ArrowUpRight size={14} />
              </button>
            ) : (
              <span>Registration is currently closed. Contact your class administrator.</span>
            )}
          </div>
          <div className="private-note">
            <ShieldCheck size={19} />
            <span>
              A private community. Shared knowledge.
              <br />
              For approved members only.
            </span>
          </div>
          <p className="disclaimer">
            An unofficial portal for the BME Professional Pilot 2026 student community. Not a
            university system.
          </p>
        </div>
      </section>
    </main>
  )
}
