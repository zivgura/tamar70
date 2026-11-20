// Loads the design system once, from main.jsx. Fonts are self-hosted (Fontsource); each
// file covers every script with unicode-range, so browsers download only the Hebrew and
// Latin pieces a page actually uses.
import '@fontsource/assistant/400.css'
import '@fontsource/assistant/600.css'
import '@fontsource/assistant/700.css'
import '@fontsource/frank-ruhl-libre/500.css'
import '@fontsource/frank-ruhl-libre/700.css'
import '@fontsource/amatic-sc/700.css'
import './tokens.css'
import './base.css'

export { CATEGORY_TONES, DEFAULT_TONE } from '@tamar70/shared'
