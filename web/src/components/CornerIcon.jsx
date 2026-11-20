// Which icon each corner shows. The drawings are separate files in src/assets/icons, all on a
// 24px grid with round strokes in currentColor, so they take the corner's tone from CSS.
// A corner added later in the Sheet gets the sparkle until it's mapped here.
import EnvelopeHeart from '../assets/icons/envelope-heart.svg?react'
import Hourglass from '../assets/icons/hourglass.svg?react'
import Key from '../assets/icons/key.svg?react'
import LightBulb from '../assets/icons/light-bulb.svg?react'
import Megaphone from '../assets/icons/megaphone.svg?react'
import Sparkle from '../assets/icons/sparkle.svg?react'
import SpeechBubble from '../assets/icons/speech-bubble.svg?react'
import Suitcase from '../assets/icons/suitcase.svg?react'

const CORNER_ICONS = {
  journey: Hourglass, // מסע בזמן
  protest: Megaphone, // תקופת המחאה
  travels: Suitcase, // טיולים בארץ ובעולם
  sayings: SpeechBubble, // המשפטים של תמר
  'fun-fact': LightBulb, // עובדה מעניינת על תמר
  'did-you-know': Key, // לא ידעתם על תמר
  wishes: EnvelopeHeart, // כמה מילים לתמר
  general: Sparkle, // לא בטוחים – כללי
}

/** The corner's icon. Decorative: the corner's name is always written next to it. */
export function CornerIcon({ id, size = 24, className = '' }) {
  const Icon = CORNER_ICONS[id] ?? Sparkle
  return (
    <Icon className={className} width={size} height={size} aria-hidden="true" focusable="false" />
  )
}
