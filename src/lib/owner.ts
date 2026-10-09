// SHA-256 of the owner password. Moves to an env var with shared storage (PLAN.md milestone 2).
export const PASSWORD_HASH = 'd1670a8a2a88d3dec653934a9a19a2b53d42bb1f3429fbdd28688d445c705f91'
export const SESSION_KEY = 'lisa-engagement:studio'
/** Holds the typed password for this tab so Studio uploads can be verified on the server */
export const SESSION_PW_KEY = 'lisa-engagement:studio-pw'

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function isOwnerPassword(pw: string | null) {
  return !!pw && (await sha256(pw)) === PASSWORD_HASH
}
