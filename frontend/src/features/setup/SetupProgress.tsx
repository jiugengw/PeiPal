const steps = ['Household', 'Profile', 'Sharing', 'Trusted circle']

export function SetupProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Setup progress">
      <ol className="grid gap-2 sm:grid-cols-4 lg:block lg:space-y-2">
        {steps.map((label, index) => {
          const isCurrent = index === currentStep
          const isComplete = index < currentStep
          return (
            <li
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold ${
                isCurrent ? 'bg-primary text-primary-foreground' : 'text-foreground'
              }`}
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`grid min-h-7 min-w-7 flex-none place-items-center rounded-full border px-2 ${
                  isCurrent ? 'border-primary-foreground' : 'border-input bg-background'
                }`}
                aria-hidden="true"
              >
                {isComplete ? 'Done' : index + 1}
              </span>
              <span>{label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
