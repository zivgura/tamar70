// What to tell people when something fails, by API error code. Plain, kind Hebrew.
const MESSAGES = {
  submissions_closed: 'ההוספה סגורה כרגע.',
  too_many_photos: 'אפשר לצרף עד 20 תמונות לכל סיפור.',
  validation: 'משהו בפרטים לא תקין. בדקו ונסו שוב.',
  forbidden: 'אין הרשאה לעדכן את הסיפור הזה מהמכשיר הזה.',
  doc_not_shared:
    'אי אפשר לפתוח את המסמך. בגוגל דוקס לחצו "שיתוף", בחרו "כל מי שיש לו את הקישור" ונסו שוב.',
  doc_bad_link: 'זה לא קישור למסמך Google Docs.',
  editing_closed: 'הסיפורים כבר נחשפו, ואי אפשר לשנות אותם יותר.',
  sign_in_required: 'צריך להיכנס שוב עם Google.',
  not_admin: 'לחשבון הזה אין הרשאת ניהול.',
  not_found: 'זה כבר לא קיים. אולי מישהו אחר מחק את זה.',
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
