import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // The saved site data (api/queries.js) must not leak from one test into the next.
  window.localStorage.removeItem('tamar70.bootstrap')
})

// jsdom has <dialog> but not showModal/close.
HTMLDialogElement.prototype.showModal ??= function showModal() {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function close() {
  this.open = false
  this.dispatchEvent(new Event('close'))
}
