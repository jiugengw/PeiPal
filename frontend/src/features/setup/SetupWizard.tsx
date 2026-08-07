import type { components } from "@/generated/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SetupProgress } from "@/features/setup/SetupProgress";
import {
  familiesQueryOptions,
  olderAdultsQueryOptions,
  familyMembersQueryOptions,
} from "@/features/setup/api/setupQueries";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { fetchClient } from "@/lib/fetchClient";
import { sendSignInLink } from "@/features/auth/sendSignInLink";

type OlderAdultDraft = components["schemas"]["OlderAdultCreate"];
type OlderAdultUpdate = components["schemas"]["OlderAdultUpdate"];
type FamilyMember = components["schemas"]["FamilyMemberResponse"];
type OlderAdult = components["schemas"]["OlderAdultResponse"];

const fieldClass =
  "mt-2 min-h-14 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-foreground/60";
const labelClass = "block text-base font-extrabold text-foreground";
const primaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return "We could not save that yet. Check your connection and try again.";
}

export function SetupWizard() {
  const progress = useSetupProgress();

  if (progress.isPending)
    return <SetupStatus message="Loading your saved setup…" />;
  if (progress.isError) {
    return (
      <SetupStatus
        message="We could not load your setup."
        action={
          <button
            className={primaryButtonClass}
            onClick={() => void progress.familiesQuery.refetch()}
          >
            Try again
          </button>
        }
      />
    );
  }

  return <SetupWizardForm progress={progress} />;
}

function SetupWizardForm({
  progress,
}: {
  progress: ReturnType<typeof useSetupProgress>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(
    progress.olderAdult ? 3 : progress.family ? 1 : 0,
  );
  const [familyName, setFamilyName] = useState(progress.family?.name ?? "");
  const [ownerEmail, setOwnerEmail] = useState(progress.family?.owner_email ?? "");
  const [profile, setProfile] = useState<OlderAdultDraft>({
    family_id: progress.family?.id ?? 0,
    name: progress.olderAdult?.name ?? "",
    preferred_name: progress.olderAdult?.preferred_name ?? "",
    age: progress.olderAdult?.age ?? null,
    language: progress.olderAdult?.language ?? "",
    email: progress.olderAdult?.email ?? "",
    mobility_notes: progress.olderAdult?.mobility_notes ?? "",
    transport_notes: progress.olderAdult?.transport_notes ?? "",
    sharing_mode: progress.olderAdult?.sharing_mode ?? "family_approval",
  });
  const [saveError, setSaveError] = useState("");

  const createFamily = useMutation({
    mutationFn: async ({ name, email }: { name: string; email: string }) => {
      const { data, error } = await fetchClient.POST("/api/families", {
        body: { name, owner_email: email },
      });
      if (error) throw error;
      return data;
    },
  });
  const updateFamily = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const { data, error } = await fetchClient.PATCH(
        "/api/families/{family_id}",
        {
          params: { path: { family_id: id } },
          body: { name },
        },
      );
      if (error) throw error;
      return data;
    },
  });
  const saveProfile = useMutation({
    mutationFn: async (draft: OlderAdultDraft) => {
      if (progress.olderAdult) {
        const body: OlderAdultUpdate = {
          name: draft.name,
          preferred_name: draft.preferred_name,
          age: draft.age,
          language: draft.language,
          email: draft.email,
          mobility_notes: draft.mobility_notes,
          transport_notes: draft.transport_notes,
          sharing_mode: draft.sharing_mode,
        };
        const { data, error } = await fetchClient.PATCH(
          "/api/older-adults/{older_adult_id}",
          {
            params: { path: { older_adult_id: progress.olderAdult.id } },
            body,
          },
        );
        if (error) throw error;
        return data;
      }
      const { data, error } = await fetchClient.POST("/api/older-adults", {
        body: draft,
      });
      if (error) throw error;
      return data;
    },
  });

  async function submitFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      // Renaming a family that already exists never re-runs verification; only
      // a newly created family still has an unconfirmed email address.
      if (progress.family) {
        await updateFamily.mutateAsync({
          id: progress.family.id,
          name: familyName.trim(),
        });
        await queryClient.invalidateQueries({
          queryKey: familiesQueryOptions().queryKey,
        });
        setCurrentStep(1);
        return;
      }

      const saved = await createFamily.mutateAsync({
        name: familyName.trim(),
        email: ownerEmail.trim().toLowerCase(),
      });
      await queryClient.invalidateQueries({
        queryKey: familiesQueryOptions().queryKey,
      });
      if (saved) {
        setProfile((value) => ({ ...value, family_id: saved.id }));
      }
      setCurrentStep(1);
    } catch (error) {
      setSaveError(errorMessage(error));
    }
  }

  function submitProfileDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    setCurrentStep(2);
  }

  async function submitSharing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const saved = await saveProfile.mutateAsync({
        ...profile,
        family_id: progress.family?.id ?? profile.family_id,
        preferred_name: profile.preferred_name || null,
        email: profile.email || null,
        language: profile.language || null,
        mobility_notes: profile.mobility_notes || null,
        transport_notes: profile.transport_notes || null,
      });
      if (saved) {
        await queryClient.invalidateQueries({
          queryKey: olderAdultsQueryOptions(saved.family_id).queryKey,
        });
      }
      setCurrentStep(3);
    } catch (error) {
      setSaveError(errorMessage(error));
    }
  }

  const isSaving =
    createFamily.isPending ||
    updateFamily.isPending ||
    saveProfile.isPending;

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
            <form onSubmit={submitFamily}>
              <StepHeading
                title="Who are we setting this up for?"
                description="Start with a family name everyone will recognize."
              />
              <label className={labelClass} htmlFor="family-name">
                Family name
              </label>
              <input
                className={fieldClass}
                id="family-name"
                maxLength={120}
                required
                value={familyName}
                onChange={(event) => setFamilyName(event.target.value)}
                placeholder="For example, Lim Family"
              />
              {!progress.family ? (
                <>
                  <label className={`${labelClass} mt-6`} htmlFor="owner-email">
                    Your email address
                  </label>
                  <p className="mt-1 text-base leading-relaxed text-foreground">
                    We send a short code here to confirm the address before your
                    family is set up.
                  </p>
                  <input
                    className={fieldClass}
                    id="owner-email"
                    type="email"
                    maxLength={320}
                    required
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </>
              ) : null}
              <FormActions
                error={saveError}
                isSaving={isSaving}
                primaryLabel={
                  progress.family ? "Save and continue" : "Create family"
                }
              />
            </form>
          ) : null}


          {currentStep === 1 ? (
            <form onSubmit={submitProfileDetails}>
              <StepHeading
                title="Tell us what makes support comfortable."
                description="Only add what will help with activity suggestions and practical planning."
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input
                    className={fieldClass}
                    required
                    maxLength={120}
                    value={profile.name}
                    onChange={(event) =>
                      setProfile({ ...profile, name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Preferred name">
                  <input
                    className={fieldClass}
                    maxLength={120}
                    value={profile.preferred_name ?? ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        preferred_name: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Age">
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    max={130}
                    value={profile.age ?? ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        age: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="Preferred language">
                  <input
                    className={fieldClass}
                    maxLength={80}
                    value={profile.language ?? ""}
                    onChange={(event) =>
                      setProfile({ ...profile, language: event.target.value })
                    }
                  />
                </Field>
                <Field label="Their email address" wide>
                  <input
                    className={fieldClass}
                    type="email"
                    maxLength={320}
                    value={profile.email ?? ""}
                    onChange={(event) =>
                      setProfile({ ...profile, email: event.target.value })
                    }
                    placeholder="mary@example.com"
                  />
                  <span className="mt-1 block text-base font-normal leading-relaxed text-foreground">
                    This becomes their sign-in. They receive a link by email each
                    time and never need a password.
                  </span>
                </Field>
                <Field label="Mobility notes" wide>
                  <textarea
                    className={fieldClass}
                    rows={3}
                    maxLength={2000}
                    value={profile.mobility_notes ?? ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        mobility_notes: event.target.value,
                      })
                    }
                    placeholder="For example, prefers seated activities"
                  />
                </Field>
                <Field label="Transport notes" wide>
                  <textarea
                    className={fieldClass}
                    rows={3}
                    maxLength={2000}
                    value={profile.transport_notes ?? ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        transport_notes: event.target.value,
                      })
                    }
                    placeholder="For example, family can help arrange transport"
                  />
                </Field>
              </div>
              <FormActions
                back={() => setCurrentStep(0)}
                primaryLabel="Continue to sharing"
              />
            </form>
          ) : null}

          {currentStep === 2 ? (
            <form onSubmit={submitSharing}>
              <StepHeading
                title="Who confirms before a plan is shared?"
                description="This choice can be changed later. Nothing is sent while you are setting up."
              />
              <div className="space-y-3">
                <SharingChoice
                  checked={profile.sharing_mode === "family_approval"}
                  title="Family reviews first"
                  description="A family member reviews the plan before it is shared. Recommended for a supported start."
                  onChange={() =>
                    setProfile({ ...profile, sharing_mode: "family_approval" })
                  }
                />
                <SharingChoice
                  checked={profile.sharing_mode === "direct"}
                  title="Share after personal confirmation"
                  description="Plans are shared immediately after the older adult confirms them."
                  onChange={() =>
                    setProfile({ ...profile, sharing_mode: "direct" })
                  }
                />
              </div>
              <FormActions
                back={() => setCurrentStep(1)}
                error={saveError}
                isSaving={isSaving}
                primaryLabel="Save profile"
              />
            </form>
          ) : null}

          {currentStep === 3 && progress.family ? (
            <>
              <OlderAdultAccessPanel olderAdults={progress.olderAdults} />
              <FamilyMembersStep
              familyMembers={progress.familyMembers}
              familyId={progress.family.id}
              olderAdults={progress.olderAdults}
              queryClient={queryClient}
              onBack={() => setCurrentStep(2)}
              onFinish={() => void navigate({ to: "/discover" })}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8">
      <h1 className="max-w-[15ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-foreground text-balance sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
        {description}
      </p>
    </header>
  );
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`${labelClass} ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
      {children}
    </label>
  );
}

function FormActions({
  back,
  error,
  isSaving,
  primaryLabel,
}: {
  back?: () => void;
  error?: string;
  isSaving?: boolean;
  primaryLabel: string;
}) {
  return (
    <div className="mt-8">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {back ? (
          <button className={secondaryButtonClass} type="button" onClick={back}>
            Back
          </button>
        ) : (
          <span />
        )}
        {
          <button
            className={primaryButtonClass}
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving…" : primaryLabel}
          </button>
        }
      </div>
      {error ? (
        <p className="mt-4 text-base font-bold text-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SharingChoice({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-24 cursor-pointer gap-4 rounded-2xl border p-5 ${checked ? "border-primary bg-accent" : "border-input bg-background"}`}
    >
      <input
        className="mt-1 size-5 flex-none accent-primary"
        type="radio"
        name="sharing-mode"
        checked={checked}
        onChange={onChange}
      />
      <span>
        <strong className="block text-lg text-foreground">{title}</strong>
        <span className="mt-1 block text-base leading-relaxed text-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function SetupStatus({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <div>
        <p className="text-xl font-bold text-foreground" role="status">
          {message}
        </p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </section>
  );
}

/**
 * Hands each older adult their own way in. They sign in with a link to their
 * email rather than a password, so no credential is ever shared with them.
 */
function OlderAdultAccessPanel({ olderAdults }: { olderAdults: OlderAdult[] }) {
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState("");
  const sendLink = useMutation({
    mutationFn: (email: string) => sendSignInLink(email),
  });

  const withEmail = olderAdults.filter((person) => person.email);
  if (withEmail.length === 0) return null;

  async function send(email: string) {
    setError("");
    try {
      await sendLink.mutateAsync(email);
      setSentTo((current) => [...current, email]);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <section className="mb-8 rounded-2xl bg-muted p-5 sm:p-7">
      <h2 className="text-2xl font-bold text-foreground">Give them their own access</h2>
      <p className="mt-2 max-w-[65ch] text-lg leading-relaxed text-foreground">
        Send a sign-in link to each older adult. They tap it once on their own
        device and stay signed in, with no password to remember.
      </p>
      <ul className="mt-5 divide-y divide-border border-y border-border">
        {withEmail.map((person) => (
          <li
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            key={person.id}
          >
            <div>
              <strong className="text-lg text-foreground">
                {person.preferred_name || person.name}
              </strong>
              <p className="mt-1 text-base text-foreground">{person.email}</p>
            </div>
            {sentTo.includes(person.email ?? "") ? (
              <p className="text-base font-bold text-foreground" role="status">
                Link sent
              </p>
            ) : (
              <button
                className={secondaryButtonClass}
                disabled={sendLink.isPending}
                onClick={() => void send(person.email ?? "")}
                type="button"
              >
                {sendLink.isPending ? "Sending\u2026" : "Send sign-in link"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-4 font-bold text-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function FamilyMembersStep({
  familyMembers,
  familyId,
  olderAdults,
  queryClient,
  onBack,
  onFinish,
}: {
  familyMembers: FamilyMember[];
  familyId: number;
  olderAdults: OlderAdult[];
  queryClient: ReturnType<typeof useQueryClient>;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "" });
  /** Relationship text per older-adult id. A blank value means "not related". */
  const [relationships, setRelationships] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  function relationshipList() {
    return olderAdults
      .filter((person) => relationships[person.id]?.trim())
      .map((person) => ({
        older_adult_id: person.id,
        relationship: relationships[person.id].trim(),
      }));
  }

  const saveFamilyMember = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        relationships: relationshipList(),
      };
      const result = editing
        ? await fetchClient.PATCH("/api/family-members/{family_member_id}", {
            params: { path: { family_member_id: editing.id } },
            body,
          })
        : await fetchClient.POST("/api/family-members", {
            body: { family_id: familyId, ...body },
          });
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const removeFamilyMember = useMutation({
    mutationFn: async (familyMemberId: number) => {
      const { error: apiError } = await fetchClient.DELETE(
        "/api/family-members/{family_member_id}",
        { params: { path: { family_member_id: familyMemberId } } },
      );
      if (apiError) throw apiError;
    },
  });

  async function refreshFamilyMembers() {
    await queryClient.invalidateQueries({
      queryKey: familyMembersQueryOptions(familyId).queryKey,
    });
  }
  function resetDraft() {
    setEditing(null);
    setDraft({ name: "", email: "" });
    setRelationships({});
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (relationshipList().length === 0) {
      setError(
        "Say how this person is related to at least one of your older adults.",
      );
      return;
    }
    try {
      await saveFamilyMember.mutateAsync();
      await refreshFamilyMembers();
      resetDraft();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  async function remove(familyMemberId: number) {
    if (!window.confirm("Remove this family member?")) return;
    try {
      await removeFamilyMember.mutateAsync(familyMemberId);
      await refreshFamilyMembers();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  function edit(member: FamilyMember) {
    setEditing(member);
    setDraft({ name: member.name, email: member.email });
    setRelationships(
      Object.fromEntries(
        member.relationships.map((link) => [
          link.older_adult_id,
          link.relationship,
        ]),
      ),
    );
    setError("");
  }

  function describeRelationships(member: FamilyMember) {
    return member.relationships
      .map((link) => {
        const person = olderAdults.find(
          (candidate) => candidate.id === link.older_adult_id,
        );
        const name = person?.preferred_name || person?.name;
        return name ? `${link.relationship} of ${name}` : link.relationship;
      })
      .join(" · ");
  }

  return (
    <div>
      <StepHeading
        title="Who is in the family?"
        description="Add the people who should receive the request when your older adult asks for support. Everyone is emailed, and the first person to answer decides."
      />
      {familyMembers.length ? (
        <ul className="mb-8 divide-y divide-border border-y border-border">
          {familyMembers.map((member) => (
            <li
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              key={member.id}
            >
              <div>
                <strong className="text-lg text-foreground">
                  {member.name}
                </strong>
                <p className="mt-1 text-base text-foreground">
                  {describeRelationships(member)} · {member.email}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => edit(member)}
                >
                  Edit
                </button>
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => void remove(member.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-8 rounded-2xl bg-muted p-5 text-lg text-foreground">
          No one has been added yet. Add at least one family member to finish
          setup.
        </p>
      )}
      <form
        className="rounded-2xl bg-background p-5 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)] sm:p-7"
        onSubmit={submit}
      >
        <h2 className="text-2xl font-bold text-foreground">
          {editing ? "Edit family member" : "Add a family member"}
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Name" required>
            <input
              className={fieldClass}
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </Field>
          <Field label="Email" required>
            <input
              className={fieldClass}
              type="email"
              required
              maxLength={320}
              value={draft.email}
              onChange={(event) =>
                setDraft({ ...draft, email: event.target.value })
              }
            />
          </Field>
        </div>
        <fieldset className="mt-6">
          <legend className={labelClass}>
            How are they related?
          </legend>
          <p className="mt-1 text-base leading-relaxed text-foreground">
            Fill in a relationship for each older adult this person supports.
            Leave a box empty if it does not apply.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {olderAdults.map((person) => (
              <Field
                key={person.id}
                label={`Relationship to ${person.preferred_name || person.name}`}
              >
                <input
                  className={fieldClass}
                  maxLength={80}
                  placeholder="For example, Daughter"
                  value={relationships[person.id] ?? ""}
                  onChange={(event) =>
                    setRelationships({
                      ...relationships,
                      [person.id]: event.target.value,
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </fieldset>
        <div className="mt-6 flex flex-wrap gap-3">
          {editing ? (
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={resetDraft}
            >
              Cancel edit
            </button>
          ) : null}
          <button
            className={primaryButtonClass}
            disabled={saveFamilyMember.isPending}
            type="submit"
          >
            {saveFamilyMember.isPending
              ? "Saving\u2026"
              : editing
                ? "Save family member"
                : "Add family member"}
          </button>
        </div>
        {error ? (
          <p className="mt-4 font-bold text-foreground" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button className={secondaryButtonClass} type="button" onClick={onBack}>
          Back
        </button>
        <button
          className={primaryButtonClass}
          type="button"
          disabled={!familyMembers.length}
          onClick={onFinish}
        >
          Finish setup
        </button>
      </div>
    </div>
  );
}
