import type {
  FileReadResult,
  StoredFileResult,
  UploadFileInput,
} from './storage.types'

export interface StorageProvider {
  upload(input: UploadFileInput): Promise<StoredFileResult>
  getFile(storageKey: string): Promise<FileReadResult>
  exists(storageKey: string): Promise<boolean>
  delete(storageKey: string): Promise<void>
  move?(sourceStorageKey: string, destinationStorageKey: string): Promise<void>
}
