/**
 * blob-storage.ts
 *
 * Dual-mode image storage:
 *   - When BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID is set (Vercel production): store in Vercel Blob
 *   - Otherwise (local dev): store on the local filesystem
 *
 * All callers use the same API — they just pass/receive image paths or blob URLs.
 */

import fs from 'fs'
import path from 'path'

export const IS_BLOB = () =>
  !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

// ---------------------------------------------------------------------------
// Key / pathname helpers (shared naming convention for both modes)
// ---------------------------------------------------------------------------

export function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown'
}

/** Returns the blob key (pathname) for an athlete's finish-line image. */
export function blobKeyForAthlete(
  meetId: string,
  heatId: string,
  lastName: string,
  firstName: string,
  bib?: string | null,
): string {
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  const filename = hasBib ? `${namePart}-${bib}.jpg` : `${namePart}.jpg`
  return `images/${meetId}/${heatId}/${filename}`
}

/** Returns the blob key prefix (pathname, no trailing slash) for athlete frames. */
export function blobFramesPrefixForAthlete(
  meetId: string,
  heatId: string,
  lastName: string,
  firstName: string,
  bib?: string | null,
): string {
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  const dirName  = hasBib ? `${namePart}-${bib}-frames` : `${namePart}-frames`
  return `images/${meetId}/${heatId}/${dirName}`
}

/** Constructs the URL or path for a specific frame. */
export function frameUrl(framesDir: string, idx: number): string {
  return `${framesDir}/frame_${String(idx).padStart(2, '0')}.jpg`
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload an image buffer.
 * Returns: blob URL (production) or absolute local path (dev).
 */
export async function uploadImage(
  key: string,        // blob key OR local absolute path
  data: Buffer,
): Promise<string> {
  if (IS_BLOB()) {
    const { put } = await import('@vercel/blob')
    const { url } = await put(key, data, {
      access:           'public',
      addRandomSuffix:  false,
      allowOverwrite:   true,
      contentType:      'image/jpeg',
    })
    return url
  }

  // Local filesystem: `key` is an absolute path in this mode (caller provides it)
  fs.mkdirSync(path.dirname(key), { recursive: true })
  fs.writeFileSync(key, data)
  return key
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** True when the stored path is a remote blob URL rather than a local path. */
export function isBlobUrl(imagePath: string | null | undefined): boolean {
  return !!imagePath && imagePath.startsWith('http')
}

/** Read an image into a Buffer from either a blob URL or a local filesystem path. */
export async function readImageBuffer(imagePath: string): Promise<Buffer> {
  if (isBlobUrl(imagePath)) {
    const res = await fetch(imagePath, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status} ${imagePath}`)
    return Buffer.from(await res.arrayBuffer())
  }
  return fs.readFileSync(imagePath)
}

/** Check whether an image exists (blob URL or local path). */
export async function imageExists(imagePath: string | null | undefined): Promise<boolean> {
  if (!imagePath) return false
  if (isBlobUrl(imagePath)) {
    try {
      const res = await fetch(imagePath, { method: 'HEAD', cache: 'no-store' })
      return res.ok
    } catch {
      return false
    }
  }
  return fs.existsSync(imagePath)
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Delete an athlete's image and all their frames from storage. */
export async function deleteAthleteFiles(
  imagePath: string | null,
  framesDir: string | null,
  frameCount: number | null,
): Promise<void> {
  if (IS_BLOB()) {
    const { del } = await import('@vercel/blob')
    const urls: string[] = []
    if (imagePath?.startsWith('http')) urls.push(imagePath)
    if (framesDir?.startsWith('http')) {
      for (let i = 0; i < (frameCount ?? 0); i++) {
        urls.push(frameUrl(framesDir, i))
      }
    }
    if (urls.length > 0) {
      try { await del(urls) } catch { /* best-effort */ }
    }
  } else {
    if (imagePath && fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath) } catch { /* ignore */ }
    }
    if (framesDir && fs.existsSync(framesDir)) {
      try { fs.rmSync(framesDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}
