/** Saves text as a file through a temporary object URL; nothing is uploaded anywhere. */
export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke after the click has been handled, so the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
