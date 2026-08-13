export function Mark() {
  return (
    <div className="mark" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <g className="plate">
          <circle cx="32" cy="32" r="25" fill="none" stroke="#35F0D0" strokeWidth="1.1" opacity=".38" />
          <circle cx="32" cy="7" r="2.4" fill="#35F0D0" />
          <circle cx="57" cy="32" r="1.6" fill="#8B7CFF" />
        </g>
        <g className="plate2">
          <circle cx="32" cy="32" r="17" fill="none" stroke="#8B7CFF" strokeWidth="1.1" opacity=".38" strokeDasharray="4 7" />
          <circle cx="32" cy="49" r="1.8" fill="#FF4D9D" />
        </g>
        <rect x="14" y="30" width="36" height="4" rx="2" fill="#35F0D0" opacity=".9" />
        <rect x="10" y="25" width="5" height="14" rx="2" fill="#E6EDF5" />
        <rect x="49" y="25" width="5" height="14" rx="2" fill="#E6EDF5" />
      </svg>
    </div>
  )
}
