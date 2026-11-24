// yaksok_icons 기반 아이콘 (stroke 2, currentColor, 은은한 채움)
// 색상은 부모의 color로 제어
const PATHS = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="currentColor" fillOpacity=".15" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  pill: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" fill="currentColor" fillOpacity=".15" />
      <path d="M9.2 9.2l5.6 5.6" />
    </>
  ),
  add: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".15" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" fill="currentColor" fillOpacity=".15" />
      <path d="M4 10h16M8 3v4M16 3v4M9.5 15l2 2 3.5-3.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity=".15" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" fill="currentColor" fillOpacity=".15" />
      <path d="M10 21h4" />
    </>
  ),
  bellDot: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" fill="currentColor" fillOpacity=".15" />
      <path d="M10 21h4" />
      <circle cx="18" cy="5" r="3" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="1.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity=".15" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4L16 5l3 3L8 19z" fill="currentColor" fillOpacity=".15" />
      <path d="M14 7l3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M6 7h12l-1 13H7z" fill="currentColor" fillOpacity=".15" />
      <path d="M4 7h16M9 7V4h6v3M10 11v5M14 11v5" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  magic: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" fill="currentColor" fillOpacity=".15" />
      <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity=".15" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l9 16H3z" fill="currentColor" fillOpacity=".15" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
}

export default function Icon({ name, size = 24, strokeWidth = 2, className, style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
