import { useRef, useState, type FormEvent } from 'react'

type AuthMode = 'login' | 'signup'
type FieldName = 'name' | 'email' | 'password'
type FormErrors = Partial<Record<FieldName, string>>

interface FormValues {
  name: string
  email: string
  password: string
}

const emptyValues: FormValues = { name: '', email: '', password: '' }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  function changeMode(nextMode: AuthMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setValues(emptyValues)
    setErrors({})
    setShowPassword(false)
    setSuccessMessage('')
  }

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSuccessMessage('')
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}
    if (mode === 'signup' && !values.name.trim()) nextErrors.name = 'Enter your full name.'
    if (!values.email.trim()) nextErrors.email = 'Enter your email address.'
    else if (!emailPattern.test(values.email)) nextErrors.email = 'Enter an email address in the format name@example.com.'
    if (!values.password) nextErrors.password = 'Enter your password.'
    else if (values.password.length < 8) nextErrors.password = 'Use at least 8 characters for your password.'
    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setSuccessMessage('')

    const firstInvalidField = (mode === 'signup' ? ['name', 'email', 'password'] : ['email', 'password'])
      .find((field) => nextErrors[field as FieldName]) as FieldName | undefined
    if (firstInvalidField) {
      const refs = { name: nameRef, email: emailRef, password: passwordRef }
      refs[firstInvalidField].current?.focus()
      return
    }

    setSuccessMessage(mode === 'login'
      ? 'Your details look ready. No login occurred because account access is not connected yet.'
      : 'Your details look ready. No account was created because account access is not connected yet.')
  }

  return (
    <div className="min-w-0 bg-background">
      <div className="grid grid-cols-1 gap-1.5 rounded-xl border border-border bg-muted p-1.5 min-[521px]:grid-cols-2" role="tablist" aria-label="Account access">
        <button className={`min-h-[52px] cursor-pointer rounded-lg border-0 font-extrabold text-foreground ${mode === 'login' ? 'bg-background underline decoration-2 underline-offset-[5px] shadow-[0_5px_16px_rgb(37_44_64_/_0.10)]' : 'bg-transparent hover:bg-background/65'}`} type="button" role="tab" aria-selected={mode === 'login'} aria-controls="auth-form-panel" onClick={() => changeMode('login')}>Log in</button>
        <button className={`min-h-[52px] cursor-pointer rounded-lg border-0 font-extrabold text-foreground ${mode === 'signup' ? 'bg-background underline decoration-2 underline-offset-[5px] shadow-[0_5px_16px_rgb(37_44_64_/_0.10)]' : 'bg-transparent hover:bg-background/65'}`} type="button" role="tab" aria-selected={mode === 'signup'} aria-controls="auth-form-panel" onClick={() => changeMode('signup')}>Create account</button>
      </div>

      <div id="auth-form-panel" role="tabpanel" className="pt-[clamp(30px,5vw,48px)]">
        <h1 className="m-0 max-w-[12ch] text-[2.75rem] leading-[0.98] font-bold tracking-[-0.035em] text-balance text-foreground min-[521px]:text-[clamp(2.5rem,5vw,4.5rem)]">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="mt-[18px] max-w-[52ch] text-lg leading-relaxed">{mode === 'login'
          ? 'Enter your details to continue to Count Me In.'
          : 'Start with the essentials. You can add support preferences later.'}</p>

        <form className="mt-[34px] grid gap-6" noValidate onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <div className="grid gap-[9px]">
              <label className="text-base font-extrabold" htmlFor="auth-name">Full name</label>
              <input className="min-h-16 w-full rounded-xl border-2 border-input bg-background px-[18px] text-lg text-foreground hover:border-primary aria-invalid:border-foreground aria-invalid:bg-muted" ref={nameRef} id="auth-name" name="name" type="text" autoComplete="name" value={values.name} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'auth-name-error' : undefined} onChange={(event) => updateField('name', event.target.value)} />
              {errors.name ? <p className="m-0 text-[0.95rem] leading-[1.45] font-bold" id="auth-name-error">Please check: {errors.name}</p> : null}
            </div>
          ) : null}

          <div className="grid gap-[9px]">
            <label className="text-base font-extrabold" htmlFor="auth-email">Email address</label>
            <input className="min-h-16 w-full rounded-xl border-2 border-input bg-background px-[18px] text-lg text-foreground hover:border-primary aria-invalid:border-foreground aria-invalid:bg-muted" ref={emailRef} id="auth-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'auth-email-error' : undefined} onChange={(event) => updateField('email', event.target.value)} />
            {errors.email ? <p className="m-0 text-[0.95rem] leading-[1.45] font-bold" id="auth-email-error">Please check: {errors.email}</p> : null}
          </div>

          <div className="grid gap-[9px]">
            <label className="text-base font-extrabold" htmlFor="auth-password">Password</label>
            <div className="relative">
              <input className="min-h-16 w-full rounded-xl border-2 border-input bg-background pr-[92px] pl-[18px] text-lg text-foreground hover:border-primary aria-invalid:border-foreground aria-invalid:bg-muted" ref={passwordRef} id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={values.password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'auth-password-error' : mode === 'signup' ? 'auth-password-help' : undefined} onChange={(event) => updateField('password', event.target.value)} />
              <button className="absolute top-[7px] right-[7px] min-h-[50px] min-w-[72px] cursor-pointer rounded-lg border-0 bg-muted font-extrabold text-foreground hover:bg-accent" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            {mode === 'signup' && !errors.password ? <p className="m-0 text-[0.95rem] leading-[1.45]" id="auth-password-help">Use at least 8 characters.</p> : null}
            {errors.password ? <p className="m-0 text-[0.95rem] leading-[1.45] font-bold" id="auth-password-error">Please check: {errors.password}</p> : null}
          </div>

          <button className="min-h-[60px] cursor-pointer rounded-xl border-0 bg-primary text-lg font-extrabold text-primary-foreground hover:bg-foreground" type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
          <p className="-mt-1.5 mb-0 text-[0.95rem] leading-normal">Account access is not connected yet. These details will not be saved or sent.</p>
          {successMessage ? <p className="m-0 rounded-xl bg-muted p-[18px] leading-normal font-bold text-foreground" role="status">{successMessage}</p> : null}
        </form>
      </div>
    </div>
  )
}
