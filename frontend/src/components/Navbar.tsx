import { Link } from '@tanstack/react-router'
import { LogoutButton } from '@/features/auth/LogoutButton'
import { useAuthSession } from '@/features/auth/AuthSessionContext'

const navigation = [
  { to: '/', label: 'Discover' },
  { to: '/setup', label: 'Setup' },
  { to: '/family', label: 'Family view' },
] as const

const navLinkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-center font-bold text-foreground no-underline transition-colors hover:bg-background focus-visible:z-10 md:w-auto md:min-w-24'

export function Navbar() {
  const { session, isLoading } = useAuthSession()

  return (
    <header className="flex-none border-b border-border bg-background">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_1fr_auto] md:gap-6 md:px-8 lg:px-12">
        <Link
          className="inline-flex min-h-11 min-w-0 items-center gap-3 font-extrabold text-foreground no-underline"
          to="/"
          aria-label="Count Me In home"
        >
          <span
            className="grid size-11 flex-none place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground"
            aria-hidden="true"
          >
            CM
          </span>
          <span className="truncate text-base sm:text-lg">Count Me In</span>
        </Link>

        <nav className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1" aria-label="Primary navigation">
          <ul className="m-0 grid list-none grid-cols-3 gap-1 rounded-2xl bg-muted p-1 md:mx-auto md:flex md:w-fit">
            {navigation.map((item) => (
              <li key={item.to}>
                <Link
                  className={navLinkClass}
                  activeOptions={{ exact: item.to === '/' }}
                  activeProps={{
                    className:
                      'bg-background text-primary underline decoration-2 underline-offset-4 shadow-[0_5px_16px_rgb(37_44_64_/_0.10)]',
                  }}
                  to={item.to}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-start-2 row-start-1 justify-self-end">
          {isLoading ? (
            <span className="block h-11 w-20 rounded-xl bg-muted" aria-hidden="true" />
          ) : session ? (
            <LogoutButton />
          ) : (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-extrabold text-primary-foreground no-underline hover:bg-foreground"
              to="/auth"
              search={{ redirect: undefined }}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
