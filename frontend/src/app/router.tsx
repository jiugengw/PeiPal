import { createBrowserRouter } from 'react-router-dom'
import { App } from '@/app/App'
import { FamilyPage } from '@/pages/FamilyPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SetupPage } from '@/pages/SetupPage'
import { AuthPage } from '@/pages/AuthPage'

export const routes = [
  { path: 'auth', element: <AuthPage /> },
  { element: <App />, children: [
  { index: true, element: <HomePage /> },
  { path: 'setup', element: <SetupPage /> },
  { path: 'family', element: <FamilyPage /> },
  { path: '*', element: <NotFoundPage /> },
]}]

export const router = createBrowserRouter(routes)
