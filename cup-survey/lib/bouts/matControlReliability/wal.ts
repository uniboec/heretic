const DB_NAME = 'cup-mat-control-wal'
const DB_VERSION = 2
const COMMAND_STORE = 'commands'
const META_STORE = 'meta'

export type WalCommandStatus = 'pending' | 'acked' | 'failed'

export type WalCommandRecord = {
  clientSessionId: string
  operationId: string
  boutId: string
  boutSessionId?: string
  ownershipEpoch?: number
  sequenceNo?: number
  payloadHash?: string
  eventHash?: string
  intent: string
  payload: Record<string, unknown>
  expectedLiveRevision: number
  expectedAttemptNumber: number
  boutElapsedMs?: number
  status: WalCommandStatus
  createdAt: string
  lastError?: string
}

export type BoutSessionClientState = {
  boutId: string
  boutSessionId: string
  ownershipEpoch: number
  clientSessionId: string
  nextSequenceNo: number
  acquireRequestId: string
  sessionStatus: string
  staleAt: string | null
}

export type ClientLifecycleState = 'SCORING' | 'FINISHED_LOCALLY' | 'PENDING_SYNC' | 'COMMITTED_LOCAL'

type MetaRecord =
  | { key: 'clientSessionId'; value: string }
  | { key: `bout:${string}`; value: BoutSessionClientState }
  | { key: `lifecycle:${string}`; value: ClientLifecycleState }

function openWalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(COMMAND_STORE)) {
        const store = db.createObjectStore(COMMAND_STORE, { keyPath: 'operationId' })
        store.createIndex('clientSessionId', 'clientSessionId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('boutId', 'boutId', { unique: false })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

async function readMeta<T>(key: string): Promise<T | null> {
  const db = await openWalDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const request = tx.objectStore(META_STORE).get(key)
    request.onsuccess = () => {
      const row = request.result as { key: string; value: T } | undefined
      resolve(row?.value ?? null)
    }
    request.onerror = () => reject(request.error ?? new Error('meta read failed'))
    tx.oncomplete = () => db.close()
  })
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openWalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('meta write failed'))
  })
  db.close()
}

export async function appendWalCommand(record: WalCommandRecord): Promise<void> {
  const db = await openWalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(COMMAND_STORE, 'readwrite')
    tx.objectStore(COMMAND_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('WAL append failed'))
  })
  db.close()
}

export async function listPendingWalCommands(
  filter?: { clientSessionId?: string; boutId?: string },
): Promise<WalCommandRecord[]> {
  const db = await openWalDb()
  const rows = await new Promise<WalCommandRecord[]>((resolve, reject) => {
    const tx = db.transaction(COMMAND_STORE, 'readonly')
    const request = tx.objectStore(COMMAND_STORE).getAll()
    request.onsuccess = () => {
      const all = (request.result as WalCommandRecord[]).filter((row) => row.status === 'pending')
      resolve(
        all
          .filter((row) => !filter?.clientSessionId || row.clientSessionId === filter.clientSessionId)
          .filter((row) => !filter?.boutId || row.boutId === filter.boutId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      )
    }
    request.onerror = () => reject(request.error ?? new Error('WAL list failed'))
  })
  db.close()
  return rows
}

export async function markWalCommandStatus(
  operationId: string,
  status: WalCommandStatus,
  lastError?: string,
): Promise<void> {
  const db = await openWalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(COMMAND_STORE, 'readwrite')
    const store = tx.objectStore(COMMAND_STORE)
    const getReq = store.get(operationId)
    getReq.onsuccess = () => {
      const row = getReq.result as WalCommandRecord | undefined
      if (!row) {
        resolve()
        return
      }
      store.put({ ...row, status, ...(lastError ? { lastError } : {}) })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('WAL status update failed'))
  })
  db.close()
}

export async function loadOrCreateClientSessionId(): Promise<string> {
  if (typeof window === 'undefined') return 'server'
  const existing = await readMeta<string>('clientSessionId')
  if (existing) return existing
  const created = crypto.randomUUID()
  await writeMeta('clientSessionId', created)
  return created
}

export async function rotateClientSessionId(): Promise<string> {
  const created = crypto.randomUUID()
  if (typeof window !== 'undefined') {
    await writeMeta('clientSessionId', created)
  }
  return created
}

export async function saveBoutSessionClientState(state: BoutSessionClientState): Promise<void> {
  await writeMeta(`bout:${state.boutId}`, state)
}

export async function loadBoutSessionClientState(
  boutId: string,
): Promise<BoutSessionClientState | null> {
  return readMeta<BoutSessionClientState>(`bout:${boutId}`)
}

export async function reserveNextSequenceNo(boutId: string): Promise<number | null> {
  const state = await loadBoutSessionClientState(boutId)
  if (!state) return null
  const sequenceNo = state.nextSequenceNo
  await saveBoutSessionClientState({ ...state, nextSequenceNo: sequenceNo + 1 })
  return sequenceNo
}

export async function setClientLifecycleState(
  boutId: string,
  lifecycle: ClientLifecycleState,
): Promise<void> {
  await writeMeta(`lifecycle:${boutId}`, lifecycle)
}

export async function getClientLifecycleState(boutId: string): Promise<ClientLifecycleState | null> {
  return readMeta<ClientLifecycleState>(`lifecycle:${boutId}`)
}
