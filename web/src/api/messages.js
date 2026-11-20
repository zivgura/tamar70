// What to tell people when something fails, by API error code. Plain, kind Hebrew.
const MESSAGES = {
  bad_family_code: 'הקישור לא תקין. בקשו מהמשפחה את הקישור המלא.',
  submissions_closed: 'ההוספה סגורה כרגע.',
  too_many_photos: 'אפשר לצרף עד 20 תמונות לכל סיפור.',
  validation: 'משהו בפרטים לא תקין. בדקו ונסו שוב.',
  forbidden: 'אין הרשאה לעדכן את הסיפור הזה מהמכשיר הזה.',
  upload_failed: 'ההעלאה לא הצליחה. נסו שוב.',
  network: 'אין חיבור כרגע. בדקו את האינטרנט ונסו שוב.',
  busy: 'יש עומס רגעי. נסו שוב בעוד רגע.',
  not_configured: 'האתר עוד לא מחובר לשרת.',
}

export function errorMessage(err) {
  return MESSAGES[err?.code] ?? 'משהו השתבש. נסו שוב.'
}

export const REJECT_MESSAGES = {
  type: 'זה לא קובץ תמונה שאפשר להעלות',
  size: 'התמונה גדולה מ-25MB',
  empty: 'הקובץ ריק',
}
