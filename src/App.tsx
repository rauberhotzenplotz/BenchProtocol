import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Nebel } from './components/Nebel'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { ActivePlanProvider } from './features/plans/ActivePlanContext'
import { RestTimerProvider } from './features/training/RestTimerProvider'
import { CockpitPage } from './features/cockpit/CockpitPage'
import { TrainingPage } from './features/training/TrainingPage'
import { BenchPage } from './features/bench/BenchPage'
import { RecordsPage } from './features/records/RecordsPage'
import { VolumePage } from './features/volume/VolumePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { GuidePage } from './features/guide/GuidePage'
import { ImportPage } from './features/import/ImportPage'
import { RpeBlockPage } from './features/rpeblock/RpeBlockPage'

export default function App() {
  return (
    <>
      {/* Außerhalb der Routen: der Nebel liegt fest im Bildschirm und soll
          beim Seitenwechsel nicht neu aufgebaut werden. */}
      <Nebel />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <ActivePlanProvider>
                <RestTimerProvider>
                  <AppShell />
                </RestTimerProvider>
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
          <Route path="/bloecke" element={<RpeBlockPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/anleitung" element={<GuidePage />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/cockpit" replace />} />
        </Route>
      </Routes>
    </>
  )
}
