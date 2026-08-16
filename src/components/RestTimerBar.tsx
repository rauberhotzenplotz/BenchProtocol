import { useNavigate } from 'react-router-dom'
import { useRestTimer } from '../features/training/rest-timer-context'
import { GymRing } from './GymRing'
import { cssVars } from '../lib/style'

/** Antippen (außerhalb der beiden Knöpfe) springt zurück in den
    Gym-Modus — entweder direkt über den von der laufenden Einheit
    registrierten Rückruf, oder, falls man gerade wo anders in der App
    steht, über einen Sprung zum Trainings-Tab. */
export function RestTimerBar() {
  const { label, secondsLeft, totalSeconds, stop, addSeconds, gymActive, reopenGym } = useRestTimer()
  const navigate = useNavigate()
  if (label == null || gymActive) return null

  const ueberzogen = secondsLeft <= 0

  const zurueckZumGym = () => {
    if (reopenGym) reopenGym()
    else navigate('/training')
  }

  return (
    <div
      className={'resttimer' + (ueberzogen ? ' ueberzogen' : '')}
      role="button"
      tabIndex={0}
      onClick={zurueckZumGym}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') zurueckZumGym()
      }}
    >
      <div className="resttimer-ring" style={cssVars({ '--ring': '54px' })}>
        <GymRing secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
      </div>
      <div className="resttimer-info">
        <div className="resttimer-lab">{ueberzogen ? 'Pause überzogen' : 'Pause'}</div>
        <div className="resttimer-name">{label}</div>
      </div>
      <div className="resttimer-tasten">
        {!ueberzogen && (
          <button
            type="button"
            className="resttimer-plus"
            onClick={e => {
              e.stopPropagation()
              addSeconds(15)
            }}
            aria-label="15 Sekunden dazu"
          >
            +15s
          </button>
        )}
        <button
          type="button"
          className="resttimer-stop"
          onClick={e => {
            e.stopPropagation()
            stop()
          }}
          aria-label="Pause beenden"
        >
          Überspringen
        </button>
      </div>
    </div>
  )
}
