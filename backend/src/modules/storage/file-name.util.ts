import { basename, extname } from 'node:path'

export function sanitizeOriginalFileName(value: string): string {
  const withoutControls = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
  const safe = basename(withoutControls.replaceAll('\\', '/'))
    .replace(/["\r\n]/g, '')
    .trim()
    .slice(0, 255)
  return safe || 'document'
}

export function extensionOf(fileName: string): string {
  return extname(fileName).slice(1).toLowerCase()
}
