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
    <div className={styles.clnShell}>
      <a className={styles.clnSkipLink} href="#main-content">Skip to main content</a>
      <header className={styles.clnHeader}>
        <NavLink className={styles.clnBrand} to="/" aria-label="Count Me In home">
          <span className={styles.clnBrandMark} aria-hidden="true">CM</span><span>Count Me In</span>
        </NavLink>
        <nav aria-label="Primary navigation">
          <ul className={styles.clnNavigation}>
            {navigation.map((item) => <li key={item.to}><NavLink className={({ isActive }) => `${styles.clnNavLink} ${isActive ? styles.clnNavLinkActive : ''}`} end={item.to === '/'} to={item.to}>{item.label}</NavLink></li>)}
            {!isLoading ? <li>{session ? <LogoutButton /> : <NavLink className={styles.clnNavLink} to="/auth">Log in</NavLink>}</li> : null}
          </ul>
        </nav>
      </header>
      <main className={styles.clnMain} id="main-content"><Outlet /></main>
    </div>
  )
}
