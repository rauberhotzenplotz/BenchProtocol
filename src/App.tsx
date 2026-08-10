import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { ActivePlanProvider } from './features/plans/ActivePlanContext'
import { CockpitPage } from './features/cockpit/CockpitPage'
import { TrainingPage } from './features/training/TrainingPage'
import { BenchPage } from './features/bench/BenchPage'
import { RecordsPage } from './features/records/RecordsPage'
import { VolumePage } from './features/volume/VolumePage'
import { SettingsPage } from './features/settings/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <ActivePlanProvider>
              <AppShell />
            </ActivePlanProvider>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/cockpit" replace />} />
        <Route path="/cockpit" element={<CockpitPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/bank" element={<BenchPage />} />
        <Route path="/rekorde" element={<RecordsPage />} />
        <Route path="/volumen" element={<VolumePage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/cockpit" replace />} />
      </Route>
    </Routes>
  )
}
