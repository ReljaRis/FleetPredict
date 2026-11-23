export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const badRequest = (m: string, fields?: Record<string, string>) => new HttpError(422, m, fields)
export const unauthorized = (m = 'Sign in to continue.') => new HttpError(401, m)
export const forbidden = (m = 'Your role cannot do this.') => new HttpError(403, m)
export const notFound = (m = 'That record does not exist in your company.') => new HttpError(404, m)
export const conflict = (m: string, fields?: Record<string, string>) => new HttpError(409, m, fields)
