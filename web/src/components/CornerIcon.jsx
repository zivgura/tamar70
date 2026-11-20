// A line icon for each corner, drawn in the same style as the mockups' icons (24px grid,
// round strokes, currentColor). The color comes from the corner's tone, never from here.
// A corner added later in the Sheet gets the general sparkle until it has its own icon.

const ICONS = {
  // מסע בזמן: an hourglass
  journey: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9" />
      <path d="M9.5 19h5" />
    </>
  ),
  // תקופת המחאה: a megaphone
  protest: (
    <>
      <path d="M3.5 10v4h3l8 4.5v-13L6.5 10z" />
      <path d="M6.5 14l1.2 5h2.3l-1-4.3M17.5 9.5a3 3 0 0 1 0 5M19.8 7a6.5 6.5 0 0 1 0 10" />
    </>
  ),
  // טיולים בארץ ובעולם: a suitcase
  travels: (
    <>
      <rect x="3.5" y="7" width="17" height="12" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8.5 7v12M15.5 7v12" />
    </>
  ),
  // המשפטים של תמר: a speech bubble
  sayings: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </>
  ),
  // עובדה מעניינת על תמר: a light bulb
  'fun-fact': (
    <>
      <path d="M9.5 17.5h5M10.5 20.5h3" />
      <path d="M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.3 2.6v1.3h5v-1.3c0-1 .5-1.9 1.3-2.6A6 6 0 0 0 12 3z" />
    </>
  ),
  // לא ידעתם על תמר: a key
  'did-you-know': (
    <>
      <circle cx="8" cy="16" r="4" />
      <path d="M11 13l9-9M16.5 7.5l2 2M14 10l2 2" />
    </>
  ),
  // כמה מילים לתמר: an envelope with a heart
  wishes: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
      <path d="M12 16.8s-2.4-1.5-2.4-3a1.2 1.2 0 0 1 2.4-.6 1.2 1.2 0 0 1 2.4.6c0 1.5-2.4 3-2.4 3z" />
    </>
  ),
  // לא בטוחים – כללי (and any new corner): a sparkle
  general: <path d="M12 3l2.1 5.9L20 11l-5.9 2.1L12 19l-2.1-5.9L4 11l5.9-2.1z" />,
}

/** The corner's icon. Decorative: the corner's name is always written next to it. */
export function CornerIcon({ id, size = 24, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[id] ?? ICONS.general}
    </svg>
  )
}
