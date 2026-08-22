import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Nebel } from './components/Nebel'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { ActivePlanProvider } from './features/plans/ActivePlanContext'
import { RestTimerProvider } from './features/training/RestTimerProvider'
import { CockpitPage } from './features/cockpit/CockpitPage'
import { TrainingPage } from './features/training/TrainingPage'

// Cockpit und Training bleiben fest im Startbündel: Das eine ist die
// Startseite, das andere die Seite, auf der die App im Studio steht.
//
// Alle übrigen Seiten werden erst beim Aufrufen geladen. Ausschlaggebend
// war die Import-Seite: Ihr Tabellenleser (read-excel-file) steckte im
// Startbündel, obwohl man ihn höchstens einmal im Leben braucht. Der
// Service Worker legt die nachgeladenen Teile beim Installieren mit ab
// (globPatterns umfasst alle .js-Dateien), offline fehlt also nichts.
const BenchPage = lazy(() => import('./features/bench/BenchPage').then(m => ({ default: m.BenchPage })))
const RecordsPage = lazy(() => import('./features/records/RecordsPage').then(m => ({ default: m.RecordsPage })))
const VolumePage = lazy(() => import('./features/volume/VolumePage').then(m => ({ default: m.VolumePage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const GuidePage = lazy(() => import('./features/guide/GuidePage').then(m => ({ default: m.GuidePage })))
const ImportPage = lazy(() => import('./features/import/ImportPage').then(m => ({ default: m.ImportPage })))
const RpeBlockPage = lazy(() => import('./features/rpeblock/RpeBlockPage').then(m => ({ default: m.RpeBlockPage })))
const ExerciseLibraryPage = lazy(() =>
  import('./features/exerciseLibrary/ExerciseLibraryPage').then(m => ({ default: m.ExerciseLibraryPage })),
)

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
          <Route path="/uebungen" element={<ExerciseLibraryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/anleitung" element={<GuidePage />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/cockpit" replace />} />
        </Route>
      </Routes>
    </>
  )
}
