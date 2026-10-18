/** Triggers a browser download of in-memory bytes or text; nothing leaves the device (ADR-0001). */
export const downloadBlob = (data: BlobPart, fileName: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
