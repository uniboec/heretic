const DEVICE_TOKEN_KEY = 'cup26_device_token'

export function getDeviceToken(): string {
  if (typeof window === 'undefined') return ''
  let token = localStorage.getItem(DEVICE_TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(DEVICE_TOKEN_KEY, token)
  }
  return token
}

export function registrationDeviceHeaders(): HeadersInit {
  const token = getDeviceToken()
  if (!token) return {}
  return { 'X-Registration-Device': token }
}
