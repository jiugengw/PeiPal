import { NavLink, Outlet } from 'react-router-dom'
import { LogoutButton } from '@/features/auth/LogoutButton'
import { useAuthSession } from '@/features/auth/AuthSessionContext'
import styles from './AppShell.module.css'

const navigation = [
  { to: '/', label: 'Discover' },
  { to: '/setup', label: 'Setup' },
  { to: '/family', label: 'Family view' },
]

export function App() {
  const { session, isLoading } = useAuthSession()
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <header className={styles.header}>
        <NavLink className={styles.brand} to="/" aria-label="Count Me In home">
          <span className={styles.brandMark} aria-hidden="true">CM</span><span>Count Me In</span>
        </NavLink>
        <nav aria-label="Primary navigation">
          <ul className={styles.navigation}>
            {navigation.map((item) => <li key={item.to}><NavLink className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`} end={item.to === '/'} to={item.to}>{item.label}</NavLink></li>)}
            {!isLoading ? <li>{session ? <LogoutButton /> : <NavLink className={styles.navLink} to="/auth">Log in</NavLink>}</li> : null}
          </ul>
        </nav>
      </header>
      <main className={styles.main} id="main-content"><Outlet /></main>
    </div>
  )
}
