import { useRestTimer } from '../features/training/rest-timer-context'
import { GymRing } from './GymRing'
import { cssVars } from '../lib/style'

export function RestTimerBar() {
  const { label, secondsLeft, totalSeconds, stop, addSeconds, gymActive } = useRestTimer()
  if (label == null || gymActive) return null

  const fertig = secondsLeft <= 0

  return (
    <div className={'resttimer' + (fertig ? ' fertig' : '')}>
      <div className="resttimer-ring" style={cssVars({ '--ring': '54px' })}>
        <GymRing secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
      </div>
      <div className="resttimer-info">
        <div className="resttimer-lab">{fertig ? 'Pause vorbei' : 'Pause'}</div>
        <div className="resttimer-name">{label}</div>
      </div>
      <div className="resttimer-tasten">
        {!fertig && (
          <button type="button" className="resttimer-plus" onClick={() => addSeconds(15)} aria-label="15 Sekunden dazu">
            +15s
          </button>
        )}
        <button type="button" className="resttimer-stop" onClick={stop} aria-label="Pause beenden">
          {fertig ? 'OK' : 'Überspringen'}
        </button>
      </div>
    </div>
  )
}
