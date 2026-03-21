// @agentmap:.
// Shared utilities for file extraction.

import { open } from 'fs/promises'

/**
 * Read the first N lines of a file.
 * Returns null if file cannot be read (ENOENT, permission denied, etc.)
 */
export async function readFirstLines(filepath: string, maxLines: number): Promise<string | null> {
  let handle
  try {
    handle = await open(filepath, 'r')
  } catch {
    // File doesn't exist or can't be opened - skip silently
    return null
  }
  try {
    // Read enough bytes for ~maxLines lines (generous estimate)
    const buffer = Buffer.alloc(maxLines * 200)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const content = buffer.toString('utf8', 0, bytesRead)
    const lines = content.split('\n').slice(0, maxLines)
    return lines.join('\n')
  } finally {
    await handle.close()
  }
}
