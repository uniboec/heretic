import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { PAYMENT_PROOF_ALLOWED_MIME, PAYMENT_PROOF_MAX_BYTES } from '../config/tournament'

const DATA_ROOT = path.join(process.cwd(), 'data', 'payment-proofs')

export function getPaymentProofsRoot(): string {
  return DATA_ROOT
}

function normalizePaymentProofMime(mimeType: string, fileName?: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (PAYMENT_PROOF_ALLOWED_MIME.includes(normalized as (typeof PAYMENT_PROOF_ALLOWED_MIME)[number])) {
    return normalized
  }
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'pdf') return 'application/pdf'
  return normalized
}

export async function savePaymentProofFile(
  registrationId: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName?: string,
): Promise<{ filePath: string; fileName: string }> {
  const resolvedMime = normalizePaymentProofMime(mimeType, originalFileName)
  if (!PAYMENT_PROOF_ALLOWED_MIME.includes(resolvedMime as (typeof PAYMENT_PROOF_ALLOWED_MIME)[number])) {
    throw new Error('INVALID_FILE_TYPE')
  }
  if (buffer.byteLength > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }

  const ext =
    resolvedMime === 'application/pdf'
      ? 'pdf'
      : resolvedMime === 'image/png'
        ? 'png'
        : 'jpg'

  const dir = path.join(DATA_ROOT, registrationId)
  await mkdir(dir, { recursive: true })
  const fileName = `${randomUUID()}.${ext}`
  const filePath = path.join(dir, fileName)
  await writeFile(filePath, buffer)
  return { filePath, fileName }
}
