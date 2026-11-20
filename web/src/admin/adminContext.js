import { createContext, useContext } from 'react'

/** { token, me: { email, name }, call(action, payload) } for the signed-in admin. */
export const AdminContext = createContext(null)

export function useAdmin() {
  return useContext(AdminContext)
}
