import { createReadStream } from 'node:fs'
import { access, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from '../../../config/env'
import { AppError } from '../../../shared/errors/app-error'
import type { StorageProvider } from '../storage.interface'

export class LocalStorageProvider implements StorageProvider {
  private readonly root: string
  private readonly tempRoot: string

  constructor(options?: { root: string; tempRoot: string }) {
    this.root = resolve(options?.root ?? env.storage.localRoot)
    this.tempRoot = resolve(options?.tempRoot ?? env.storage.tempRoot)
  }

  private safePath(root: string, storageKey: string) {
    if (isAbsolute(storageKey) || storageKey.includes('\0'))
      throw new AppError('Invalid storage key', 'STORAGE_PATH_INVALID', 500)
    const target = resolve(root, storageKey)
    const rel = relative(root, target)
    if (rel.startsWith('..') || rel.includes(`..${sep}`) || isAbsolute(rel))
      throw new AppError('Invalid storage key', 'STORAGE_PATH_INVALID', 500)
    return target
  }

  async upload(input: { storageKey: string; contents: Buffer }) {
    const destination = this.safePath(this.root, input.storageKey)
    const temporary = this.safePath(this.tempRoot, `${randomUUID()}.upload`)
    await mkdir(dirname(temporary), { recursive: true })
    await mkdir(dirname(destination), { recursive: true })
    try {
      await writeFile(temporary, input.contents, { flag: 'wx', mode: 0o600 })
      await rename(temporary, destination)
      return { storageKey: input.storageKey, size: input.contents.length }
    } catch {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw new AppError('Unable to store file', 'STORAGE_WRITE_FAILED', 500)
    }
  }

  async getFile(storageKey: string) {
    const path = this.safePath(this.root, storageKey)
    try {
      const details = await stat(path)
      return { stream: createReadStream(path), size: details.size }
    } catch {
      throw new AppError('Stored file is missing', 'STORAGE_READ_FAILED', 404)
    }
  }

  async exists(storageKey: string) {
    try {
      await access(this.safePath(this.root, storageKey))
      return true
    } catch {
      return false
    }
  }

  async delete(storageKey: string) {
    await rm(this.safePath(this.root, storageKey), { force: true })
  }

  async move(sourceStorageKey: string, destinationStorageKey: string) {
    const source = this.safePath(this.root, sourceStorageKey)
    const destination = this.safePath(this.root, destinationStorageKey)
    await mkdir(dirname(destination), { recursive: true })
    await rename(source, destination)
  }
}
