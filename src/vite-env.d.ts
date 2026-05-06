/// <reference types="vite/client" />

// File System Access API types
interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}

interface FileSystemFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: Blob | string | ArrayBuffer): Promise<void>
  close(): Promise<void>
}

interface FileSystemHandle {
  kind: 'file' | 'directory'
  name: string
}

interface ShowDirectoryPickerOptions {
  mode?: 'read' | 'readwrite'
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
}

interface Window {
  showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
