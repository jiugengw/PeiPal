import type { components } from '@/generated/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { SetupProgress } from '@/features/setup/SetupProgress'
import {
  householdsQueryOptions,
  olderAdultsQueryOptions,
  trustedContactsQueryOptions,
} from '@/features/setup/api/setupQueries'
import { useSetupProgress } from '@/features/setup/useSetupProgress'
import { fetchClient } from '@/lib/fetchClient'

type OlderAdultDraft = components['schemas']['OlderAdultCreate']
type OlderAdultUpdate = components['schemas']['OlderAdultUpdate']
type TrustedContact = components['schemas']['TrustedContactResponse']

const fieldClass = 'mt-2 min-h-14 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-foreground/60'
const labelClass = 'block text-base font-extrabold text-foreground'
const primaryButtonClass = 'inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClass = 'inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  return 'We could not save that yet. Check your connection and try again.'
}

export function SetupWizard() {
  const progress = useSetupProgress()

  if (progress.isPending) return <SetupStatus message="Loading your saved setup…" />
  if (progress.isError) {
    return (
      <SetupStatus
        message="We could not load your setup."
        action={<button className={primaryButtonClass} onClick={() => void progress.householdsQuery.refetch()}>Try again</button>}
      />
    )
  }

  return <SetupWizardForm progress={progress} />
}

function SetupWizardForm({ progress }: { progress: ReturnType<typeof useSetupProgress> }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(progress.olderAdult ? 3 : progress.household ? 1 : 0)
  const [householdName, setHouseholdName] = useState(progress.household?.name ?? '')
  const [profile, setProfile] = useState<OlderAdultDraft>({
    household_id: progress.household?.id ?? 0,
    name: progress.olderAdult?.name ?? '',
    preferred_name: progress.olderAdult?.preferred_name ?? '',
    age: progress.olderAdult?.age ?? null,
    language: progress.olderAdult?.language ?? '',
    mobility_notes: progress.olderAdult?.mobility_notes ?? '',
    transport_notes: progress.olderAdult?.transport_notes ?? '',
    sharing_mode: progress.olderAdult?.sharing_mode ?? 'family_approval',
  })
  const [saveError, setSaveError] = useState('')

  const createHousehold = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await fetchClient.POST('/api/households', { body: { name } })
      if (error) throw error
      return data
    },
  })
  const updateHousehold = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const { data, error } = await fetchClient.PATCH('/api/households/{household_id}', {
        params: { path: { household_id: id } }, body: { name },
      })
      if (error) throw error
      return data
    },
  })
  const saveProfile = useMutation({
    mutationFn: async (draft: OlderAdultDraft) => {
      if (progress.olderAdult) {
        const body: OlderAdultUpdate = {
          name: draft.name,
          preferred_name: draft.preferred_name,
          age: draft.age,
          language: draft.language,
          mobility_notes: draft.mobility_notes,
          transport_notes: draft.transport_notes,
          sharing_mode: draft.sharing_mode,
        }
        const { data, error } = await fetchClient.PATCH('/api/older-adults/{older_adult_id}', {
          params: { path: { older_adult_id: progress.olderAdult.id } }, body,
        })
        if (error) throw error
        return data
      }
      const { data, error } = await fetchClient.POST('/api/older-adults', { body: draft })
      if (error) throw error
      return data
    },
  })

  async function submitHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')
    try {
      const saved = progress.household
        ? await updateHousehold.mutateAsync({ id: progress.household.id, name: householdName.trim() })
        : await createHousehold.mutateAsync(householdName.trim())
      await queryClient.invalidateQueries({ queryKey: householdsQueryOptions().queryKey })
      if (saved) setProfile((value) => ({ ...value, household_id: saved.id }))
      setCurrentStep(1)
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }

  function submitProfileDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')
    setCurrentStep(2)
  }

  async function submitSharing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')
    try {
      const saved = await saveProfile.mutateAsync({
        ...profile,
        household_id: progress.household?.id ?? profile.household_id,
        preferred_name: profile.preferred_name || null,
        language: profile.language || null,
        mobility_notes: profile.mobility_notes || null,
        transport_notes: profile.transport_notes || null,
      })
      if (saved) {
        await queryClient.invalidateQueries({
          queryKey: olderAdultsQueryOptions(saved.household_id).queryKey,
        })
      }
      setCurrentStep(3)
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }

  const isSaving = createHousehold.isPending || updateHousehold.isPending || saveProfile.isPending

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto grid w-full max-w-[1180px] gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:pt-2">
          <p className="mb-5 max-w-[24ch] text-lg leading-relaxed text-foreground">
            Four calm steps. You can come back and continue at any time.
          </p>
          <SetupProgress currentStep={currentStep} />
        </aside>

        <div className="max-w-[760px]">
          {currentStep === 0 ? (
            <form onSubmit={submitHousehold}>
              <StepHeading title="Who are we setting this up for?" description="Start with a household name everyone will recognize." />
              <label className={labelClass} htmlFor="household-name">Household name</label>
              <input className={fieldClass} id="household-name" maxLength={120} required value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="For example, Lim Family" />
              <FormActions error={saveError} isSaving={isSaving} primaryLabel={progress.household ? 'Save and continue' : 'Create household'} />
            </form>
          ) : null}

          {currentStep === 1 ? (
            <form onSubmit={submitProfileDetails}>
              <StepHeading title="Tell us what makes support comfortable." description="Only add what will help with activity suggestions and practical planning." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" required><input className={fieldClass} required maxLength={120} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
                <Field label="Preferred name"><input className={fieldClass} maxLength={120} value={profile.preferred_name ?? ''} onChange={(event) => setProfile({ ...profile, preferred_name: event.target.value })} /></Field>
                <Field label="Age"><input className={fieldClass} type="number" min={0} max={130} value={profile.age ?? ''} onChange={(event) => setProfile({ ...profile, age: event.target.value ? Number(event.target.value) : null })} /></Field>
                <Field label="Preferred language"><input className={fieldClass} maxLength={80} value={profile.language ?? ''} onChange={(event) => setProfile({ ...profile, language: event.target.value })} /></Field>
                <Field label="Mobility notes" wide><textarea className={fieldClass} rows={3} maxLength={2000} value={profile.mobility_notes ?? ''} onChange={(event) => setProfile({ ...profile, mobility_notes: event.target.value })} placeholder="For example, prefers seated activities" /></Field>
                <Field label="Transport notes" wide><textarea className={fieldClass} rows={3} maxLength={2000} value={profile.transport_notes ?? ''} onChange={(event) => setProfile({ ...profile, transport_notes: event.target.value })} placeholder="For example, family can help arrange transport" /></Field>
              </div>
              <FormActions back={() => setCurrentStep(0)} primaryLabel="Continue to sharing" />
            </form>
          ) : null}

          {currentStep === 2 ? (
            <form onSubmit={submitSharing}>
              <StepHeading title="Who confirms before a plan is shared?" description="This choice can be changed later. Nothing is sent while you are setting up." />
              <div className="space-y-3">
                <SharingChoice checked={profile.sharing_mode === 'family_approval'} title="Family reviews first" description="A family member reviews the plan before it is shared. Recommended for a supported start." onChange={() => setProfile({ ...profile, sharing_mode: 'family_approval' })} />
                <SharingChoice checked={profile.sharing_mode === 'direct'} title="Share after personal confirmation" description="Plans are shared immediately after the older adult confirms them." onChange={() => setProfile({ ...profile, sharing_mode: 'direct' })} />
              </div>
              <FormActions back={() => setCurrentStep(1)} error={saveError} isSaving={isSaving} primaryLabel="Save profile" />
            </form>
          ) : null}

          {currentStep === 3 && progress.olderAdult ? (
            <TrustedCircleStep
              contacts={progress.contacts}
              olderAdultId={progress.olderAdult.id}
              queryClient={queryClient}
              onBack={() => setCurrentStep(2)}
              onFinish={() => void navigate({ to: '/discover' })}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-8"><h1 className="max-w-[15ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-foreground text-balance sm:text-5xl">{title}</h1><p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">{description}</p></header>
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`${labelClass} ${wide ? 'sm:col-span-2' : ''}`}>{label}{required ? <span aria-hidden="true"> *</span> : null}{children}</label>
}

function FormActions({ back, error, isSaving, primaryLabel }: { back?: () => void; error?: string; isSaving?: boolean; primaryLabel: string }) {
  return <div className="mt-8"><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">{back ? <button className={secondaryButtonClass} type="button" onClick={back}>Back</button> : <span />}{<button className={primaryButtonClass} disabled={isSaving} type="submit">{isSaving ? 'Saving…' : primaryLabel}</button>}</div>{error ? <p className="mt-4 text-base font-bold text-foreground" role="alert">{error}</p> : null}</div>
}

function SharingChoice({ checked, title, description, onChange }: { checked: boolean; title: string; description: string; onChange: () => void }) {
  return <label className={`flex min-h-24 cursor-pointer gap-4 rounded-2xl border p-5 ${checked ? 'border-primary bg-accent' : 'border-input bg-background'}`}><input className="mt-1 size-5 flex-none accent-primary" type="radio" name="sharing-mode" checked={checked} onChange={onChange} /><span><strong className="block text-lg text-foreground">{title}</strong><span className="mt-1 block text-base leading-relaxed text-foreground">{description}</span></span></label>
}

function SetupStatus({ message, action }: { message: string; action?: React.ReactNode }) {
  return <section className="grid min-h-full place-items-center px-6 py-12 text-center"><div><p className="text-xl font-bold text-foreground" role="status">{message}</p>{action ? <div className="mt-5">{action}</div> : null}</div></section>
}

function TrustedCircleStep({ contacts, olderAdultId, queryClient, onBack, onFinish }: { contacts: TrustedContact[]; olderAdultId: number; queryClient: ReturnType<typeof useQueryClient>; onBack: () => void; onFinish: () => void }) {
  const [editing, setEditing] = useState<TrustedContact | null>(null)
  const [draft, setDraft] = useState({ name: '', relationship: '', email: '', phone: '' })
  const [error, setError] = useState('')
  const saveContact = useMutation({ mutationFn: async () => {
    const body = { name: draft.name.trim(), relationship: draft.relationship.trim(), email: draft.email.trim() || null, phone: draft.phone.trim() || null }
    const result = editing
      ? await fetchClient.PATCH('/api/trusted-contacts/{contact_id}', { params: { path: { contact_id: editing.id } }, body })
      : await fetchClient.POST('/api/trusted-contacts', { body: { older_adult_id: olderAdultId, ...body } })
    if (result.error) throw result.error
    return result.data
  } })
  const removeContact = useMutation({ mutationFn: async (contactId: number) => {
    const { error: apiError } = await fetchClient.DELETE('/api/trusted-contacts/{contact_id}', { params: { path: { contact_id: contactId } } })
    if (apiError) throw apiError
  } })

  async function refreshContacts() { await queryClient.invalidateQueries({ queryKey: trustedContactsQueryOptions(olderAdultId).queryKey }) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!draft.email.trim() && !draft.phone.trim()) { setError('Add an email address or phone number so this person can be contacted.'); return }
    try { await saveContact.mutateAsync(); await refreshContacts(); setEditing(null); setDraft({ name: '', relationship: '', email: '', phone: '' }) } catch (caught) { setError(errorMessage(caught)) }
  }
  async function remove(contactId: number) {
    if (!window.confirm('Remove this trusted contact?')) return
    try { await removeContact.mutateAsync(contactId); await refreshContacts() } catch (caught) { setError(errorMessage(caught)) }
  }
  function edit(contact: TrustedContact) { setEditing(contact); setDraft({ name: contact.name, relationship: contact.relationship, email: contact.email ?? '', phone: contact.phone ?? '' }); setError('') }

  return <div><StepHeading title="Build a trusted circle." description="Add up to five people who may help with reminders, transport, booking, or company." />
    {contacts.length ? <ul className="mb-8 divide-y divide-border border-y border-border">{contacts.map((contact) => <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={contact.id}><div><strong className="text-lg text-foreground">{contact.name}</strong><p className="mt-1 text-base text-foreground">{contact.relationship} · {contact.email || contact.phone}</p></div><div className="flex gap-2"><button className={secondaryButtonClass} type="button" onClick={() => edit(contact)}>Edit</button><button className={secondaryButtonClass} type="button" onClick={() => void remove(contact.id)}>Remove</button></div></li>)}</ul> : <p className="mb-8 rounded-2xl bg-muted p-5 text-lg text-foreground">No one has been added yet. Add at least one trusted contact to finish setup.</p>}
    {contacts.length < 5 || editing ? <form className="rounded-2xl bg-background p-5 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)] sm:p-7" onSubmit={submit}><h2 className="text-2xl font-bold text-foreground">{editing ? 'Edit trusted contact' : 'Add a trusted contact'}</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Name" required><input className={fieldClass} required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Relationship" required><input className={fieldClass} required maxLength={80} value={draft.relationship} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} /></Field><Field label="Email"><input className={fieldClass} type="email" maxLength={320} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field><Field label="Phone"><input className={fieldClass} type="tel" maxLength={40} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field></div><div className="mt-6 flex flex-wrap gap-3">{editing ? <button className={secondaryButtonClass} type="button" onClick={() => { setEditing(null); setDraft({ name: '', relationship: '', email: '', phone: '' }) }}>Cancel edit</button> : null}<button className={primaryButtonClass} disabled={saveContact.isPending} type="submit">{saveContact.isPending ? 'Saving…' : editing ? 'Save contact' : 'Add contact'}</button></div>{error ? <p className="mt-4 font-bold text-foreground" role="alert">{error}</p> : null}</form> : <p className="rounded-2xl bg-muted p-5 text-lg font-bold text-foreground">Your trusted circle has five people, which is the limit for this demo.</p>}
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button className={secondaryButtonClass} type="button" onClick={onBack}>Back</button><button className={primaryButtonClass} type="button" disabled={!contacts.length} onClick={onFinish}>Finish setup</button></div>
  </div>
}
