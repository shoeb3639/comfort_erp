import { mkdtemp, readFile, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError } from '../../shared/errors/app-error'
import { sanitizeOriginalFileName } from './file-name.util'
import { validateFileType } from './mime-type.util'
import { LocalStorageProvider } from './providers/local-storage.provider'
import { buildStorageKey } from './storage-key.util'
import type { StorageProvider } from './storage.interface'
import { storeWithCompensation } from './storage.service'

describe('central storage safety', () => {
  it('sanitizes path traversal and header control characters', () => {
    expect(sanitizeOriginalFileName('../../bad\r\ninvoice.pdf')).toBe(
      'badinvoice.pdf',
    )
    expect(sanitizeOriginalFileName('..\\..\\license.pdf')).toBe('license.pdf')
  })

  it('builds tenant-first provider-independent keys', () => {
    expect(
      buildStorageKey({
        tenantId: 'tenant-a',
        entityType: 'INVOICE',
        entityId: 'invoice-a',
        financialYear: '25-26',
        storedFileName: 'file.pdf',
      }),
    ).toBe('tenants/tenant-a/invoices/25-26/invoice-a/file.pdf')
  })

  it('checks extension, MIME, and magic bytes', () => {
    const pdf = Buffer.from('%PDF-1.7 valid')
    expect(
      validateFileType({
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        contents: pdf,
      }),
    ).toEqual({ extension: 'pdf', mimeType: 'application/pdf' })
    expect(() =>
      validateFileType({
        fileName: 'invoice.pdf.exe',
        mimeType: 'application/pdf',
        contents: pdf,
      }),
    ).toThrow(AppError)
    expect(() =>
      validateFileType({
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        contents: Buffer.from('not a pdf'),
      }),
    ).toThrow('contents do not match')
  })
})

describe('LocalStorageProvider', () => {
  let directory: string
  let provider: LocalStorageProvider

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cablix-storage-test-'))
    provider = new LocalStorageProvider({
      root: join(directory, 'final'),
      tempRoot: join(directory, 'temp'),
    })
  })

  afterEach(async () => rm(directory, { recursive: true, force: true }))

  it('atomically writes and streams a relative storage key', async () => {
    const key = 'tenants/tenant-a/vehicles/vehicle-a/file.pdf'
    await expect(
      provider.upload({ storageKey: key, contents: Buffer.from('%PDF-test') }),
    ).resolves.toEqual({ storageKey: key, size: 9 })
    await expect(provider.exists(key)).resolves.toBe(true)
    await expect(readFile(join(directory, 'final', key), 'utf8')).resolves.toBe(
      '%PDF-test',
    )
    const result = await provider.getFile(key)
    expect(result.size).toBe(9)
    result.stream.destroy()
  })

  it('rejects traversal keys', async () => {
    await expect(
      provider.upload({
        storageKey: '../outside.pdf',
        contents: Buffer.from('%PDF-test'),
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_PATH_INVALID' })
  })

  it('returns a controlled error when physical bytes are missing', async () => {
    const key = 'tenants/tenant-a/bookings/booking-a/file.pdf'
    await provider.upload({
      storageKey: key,
      contents: Buffer.from('%PDF-test'),
    })
    await unlink(join(directory, 'final', key))
    await expect(provider.getFile(key)).rejects.toMatchObject({
      code: 'STORAGE_READ_FAILED',
    })
  })
})

describe('upload compensation', () => {
  it('removes physical bytes when the metadata transaction fails', async () => {
    const storageKey = 'tenants/tenant-a/vehicles/vehicle-a/file.pdf'
    const deleteFile = jest.fn().mockResolvedValue(undefined)
    const provider: StorageProvider = {
      upload: jest.fn().mockResolvedValue({ storageKey, size: 9 }),
      getFile: jest.fn(),
      exists: jest.fn(),
      delete: deleteFile,
      move: jest.fn(),
    }
    const databaseError = new Error('metadata insert failed')

    await expect(
      storeWithCompensation(
        provider,
        { storageKey, contents: Buffer.from('%PDF-test') },
        () => Promise.reject(databaseError),
      ),
    ).rejects.toBe(databaseError)
    expect(deleteFile).toHaveBeenCalledWith(storageKey)
  })
})
