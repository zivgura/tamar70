import { ERROR_CODES } from '@tamar70/shared'

/** An error whose code and message are safe to send to the browser. */
export class ApiError extends Error {
  constructor(code, message = code) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export const notFound = (what = 'Not found') => new ApiError(ERROR_CODES.NOT_FOUND, what)
