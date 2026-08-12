// A plain fetch + Basic Auth wrapper for DHIS2's REST API -- deliberately
// not @dhis2/app-runtime, since this tool isn't a DHIS2 App and never runs
// inside DHIS2's own web shell. Every payload SHAPE this calls with is
// reused unchanged from the already-confirmed-live sibling apps
// (dhis2-otss-supervision-log/src/lib/provisioning.ts); only this HTTP
// layer is new.

export interface Dhis2Config {
  baseUrl: string
  username: string
  password: string
}

export class Dhis2HttpError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'Dhis2HttpError'
    this.status = status
    this.body = body
  }
}

function authHeader(config: Dhis2Config): string {
  return 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
}

async function request<T>(config: Dhis2Config, method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: authHeader(config),
      Accept: 'application/json',
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Dhis2HttpError(`DHIS2 ${method} ${path} failed: ${response.status} ${response.statusText}`, response.status, body)
  }
  return body as T
}

export function dhis2Get<T>(config: Dhis2Config, path: string): Promise<T> {
  return request<T>(config, 'GET', path)
}

export function dhis2Post<T>(config: Dhis2Config, path: string, data: unknown): Promise<T> {
  return request<T>(config, 'POST', path, data)
}

export function dhis2Put<T>(config: Dhis2Config, path: string, data: unknown): Promise<T> {
  return request<T>(config, 'PUT', path, data)
}

export async function dhis2GetOrNull<T>(config: Dhis2Config, path: string): Promise<T | null> {
  try {
    return await dhis2Get<T>(config, path)
  } catch (error) {
    if (error instanceof Dhis2HttpError && error.status === 404) return null
    throw error
  }
}
