/**
 * Every matching file on the clipboard. Copying a selection in Finder puts all
 * of it there, so read the whole list rather than the first entry. `files`
 * covers Finder copies and screenshots; `items` is the fallback for browsers
 * that only populate that.
 */
export function filesFromClipboard(
  data: DataTransfer | null,
  accept: (file: File) => boolean,
): File[] {
  const files = Array.from(data?.files ?? []).filter(accept)
  if (files.length > 0) return files

  return Array.from(data?.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null && accept(file))
}

export function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isMedia(file: File): boolean {
  return isImage(file) || file.type.startsWith('video/')
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}
