import { SESSION_PW_KEY } from './owner'

/** Shrinks a photo to a web-friendly JPEG */
function resizeImage(file: File, max = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', 0.86)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Uploads a Studio photo to site storage and returns its public URL */
export async function uploadImage(file: File): Promise<string> {
  const blob = await resizeImage(file)
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg', 'x-studio-password': sessionStorage.getItem(SESSION_PW_KEY) ?? '' },
    body: blob,
  })
  if (res.status === 401) throw new Error('Please lock and unlock the Studio again, then retry the upload.')
  if (!res.ok) throw new Error('The photo could not be uploaded — try a smaller image.')
  return (await res.json()).url
}
