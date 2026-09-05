import { AppError } from '../../shared/errors/app-error'
import { DANGEROUS_EXTENSIONS } from './storage.constants'
import { extensionOf } from './file-name.util'

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  csv: ['text/csv', 'application/csv', 'text/plain'],
  xls: ['application/vnd.ms-excel'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  doc: ['application/msword'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
}

function startsWith(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte)
}

function signatureMatches(extension: string, contents: Buffer) {
  if (extension === 'pdf') return contents.subarray(0, 5).toString() === '%PDF-'
  if (extension === 'jpg' || extension === 'jpeg')
    return startsWith(contents, [0xff, 0xd8, 0xff])
  if (extension === 'png')
    return startsWith(
      contents,
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    )
  if (extension === 'webp')
    return (
      contents.subarray(0, 4).toString() === 'RIFF' &&
      contents.subarray(8, 12).toString() === 'WEBP'
    )
  if (extension === 'doc' || extension === 'xls')
    return startsWith(
      contents,
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    )
  if (extension === 'docx' || extension === 'xlsx')
    return startsWith(contents, [0x50, 0x4b, 0x03, 0x04])
  if (extension === 'csv')
    return (
      !contents.includes(0) &&
      contents.subarray(0, 4096).toString('utf8').includes(',')
    )
  return false
}

export function validateFileType(input: {
  fileName: string
  mimeType: string
  contents: Buffer
}) {
  const extension = extensionOf(input.fileName)
  if (!extension || DANGEROUS_EXTENSIONS.has(extension))
    throw new AppError(
      'Dangerous or missing file extension',
      'INVALID_FILE_TYPE',
      415,
    )
  const allowedMimes = MIME_BY_EXTENSION[extension]
  if (!allowedMimes?.includes(input.mimeType.toLowerCase()))
    throw new AppError(
      'File extension and MIME type do not match',
      'INVALID_FILE_TYPE',
      415,
    )
  if (!signatureMatches(extension, input.contents))
    throw new AppError(
      'File contents do not match the declared type',
      'INVALID_FILE_TYPE',
      415,
    )
  return { extension, mimeType: allowedMimes[0]! }
}
