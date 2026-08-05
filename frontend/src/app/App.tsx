import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppShell.module.css'

const navigation = [
  { to: '/', label: 'Discover' },
  { to: '/setup', label: 'Setup' },
  { to: '/family', label: 'Family view' },
]

export function App() {
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
          </ul>
        </nav>
      </header>
      <main className={styles.main} id="main-content"><Outlet /></main>
      <footer className={styles.footer}>Plans stay private until the older adult chooses to share them.</footer>
    </div>
  )
}
