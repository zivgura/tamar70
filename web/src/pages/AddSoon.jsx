import { Link } from 'react-router-dom'
import { Message } from '../components'

// Placeholder until milestone 4b brings the add-a-memory flow.
export default function AddSoon() {
  return (
    <Message>
      <h1>הוספת זיכרון</h1>
      <p>האפשרות להוסיף זיכרונות תיפתח בקרוב.</p>
      <Link to="/">לדף הבית</Link>
    </Message>
  )
}
