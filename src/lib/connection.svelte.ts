// WebSocket JSON-RPC 2.0 client for a live uConfig device.
// Endpoint: ws://<host>/uconfig, subprotocol "uconfig".
//
// The methods that act on the device are top level and take no address: a
// device managing itself has nothing to address. The venue and peer are still
// resolved after login, because the uCoord page needs to know which peer in
// the venue is the one being managed.

import type { UcoordStatus } from './ucoord.svelte.ts'

interface Target {
  venue: string
  peer: string
}

interface Device extends Target {
  model: string | null
}

interface UploadResult {
  file_id?: string
  error?: string
  [key: string]: unknown
}

interface PendingEntry {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

interface RpcEvent {
  method?: string
  id?: never
}

interface RpcResponse {
  id: number
  result?: unknown
  error?: { message?: string }
}

const READY_TIMEOUT_MS = 8000

// The device closes an idle websocket ("Upstream connection timeout"), which
// signs the session out from under the user. Pages that poll keep it busy on
// their own, but the config and system sections send nothing at all, so the
// connection layer keeps it alive for them. Well inside the observed window.
const KEEPALIVE_MS = 30000
const IDLE_BEFORE_PING_MS = 25000

// Resolved after login so the uCoord page can mark which peer in the venue is
// the one being managed. The device's own methods do not use it.
let target: Target | null = null

let socket: WebSocket | null = null
let next_id = 1
const pending = new Map<number, PendingEntry>()

let keepalive_timer: ReturnType<typeof setInterval> | null = null
let last_send = 0

// connect() resolves only once the server sends the login-required event.
let ready_resolve: (() => void) | null = null
let ready_reject: ((reason: Error) => void) | null = null
let ready_timer: ReturnType<typeof setTimeout> | null = null

export const connection = $state<{
  status: 'idle' | 'connecting' | 'connected'
  mode: 'standalone' | 'ucoord' | null
  modules: string[] | null // optional packages the device reports at login
  device: Device | null
  lost: boolean
  host: string | null
  error: string | null
}>({
  status: 'idle',
  mode: null,
  modules: null,
  device: null,
  lost: false,
  host: null,
  error: null
})

function reject_pending(reason: string) {
  for (const { reject } of pending.values()) reject(new Error(reason))
  pending.clear()
}

function ready_clear() {
  if (ready_timer) clearTimeout(ready_timer)
  ready_timer = null
  ready_resolve = null
  ready_reject = null
}

function ready_resolve_now() {
  const resolve = ready_resolve
  ready_clear()
  resolve?.()
}

function ready_reject_now(message: string) {
  const reject = ready_reject
  ready_clear()
  reject?.(new Error(message))
}

function handle_event(msg: RpcEvent) {
  if (msg.method === 'login-required') ready_resolve_now()
}

function keepalive_stop() {
  if (keepalive_timer) clearInterval(keepalive_timer)
  keepalive_timer = null
}

// Ping only when the socket has actually gone quiet, so polling pages -- which
// already keep it busy -- cost nothing extra.
function keepalive_start() {
  keepalive_stop()
  keepalive_timer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    if (Date.now() - last_send < IDLE_BEFORE_PING_MS) return
    request('ping', {}).catch(() => {
      /* a dead socket surfaces through onclose */
    })
  }, KEEPALIVE_MS)
}

function on_message(event: MessageEvent) {
  let msg: RpcEvent | RpcResponse
  try {
    msg = JSON.parse(event.data)
  } catch {
    return
  }
  if (msg.id == null) {
    handle_event(msg)
    return
  }
  const response = msg as RpcResponse
  const entry = pending.get(response.id)
  if (!entry) return
  pending.delete(response.id)
  if (response.error) entry.reject(new Error(response.error.message || 'request failed'))
  else entry.resolve(response.result)
}

export function request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      reject(new Error('not connected'))
      return
    }
    const args: Record<string, unknown> = params ?? {}
    const id = next_id++
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    last_send = Date.now()
    socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params: args }))
  })
}

// Open the socket; resolves once the server signals login-required.
export function connect(host: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      socket = new WebSocket(`ws://${host}/uconfig`, 'uconfig')
    } catch (e) {
      reject(e as Error)
      return
    }
    connection.status = 'connecting'
    connection.host = host
    connection.error = null
    ready_resolve = resolve
    ready_reject = reject
    ready_timer = setTimeout(() => {
      ready_reject_now('timed out waiting for the device')
      try {
        socket?.close()
      } catch {
        /* already closing */
      }
    }, READY_TIMEOUT_MS)
    socket.onmessage = on_message
    socket.onopen = () => {
      connection.status = 'connected'
    }
    socket.onclose = () => {
      keepalive_stop()
      reject_pending('connection closed')
      // An unsolicited close means the session is gone (device rebooted, link
      // dropped, idle timeout). Flag it so the app can return to the landing
      // page rather than leaving a signed-in UI that cannot reach the device.
      const established = connection.status === 'connected'
      socket = null
      target = null
      connection.status = 'idle'
      connection.device = null
      if (established) connection.lost = true
      ready_reject_now(`could not connect to ${host}`)
    }
    socket.onerror = () => {} // detail surfaced via onclose
  })
}

export function disconnect() {
  ready_clear()
  keepalive_stop()
  if (socket) {
    // Closing on purpose; drop the handler so onclose does not report the
    // session as lost.
    socket.onclose = null
    try {
      socket.close()
    } catch {
      /* already closing */
    }
  }
  socket = null
  target = null
  reject_pending('disconnected')
  connection.status = 'idle'
  connection.mode = null
  connection.modules = null
  connection.device = null
  connection.lost = false
}

// Resolve the peer to manage from the device's own status. Single-AP
// management picks the first connected peer; nothing is shown to the user.
async function target_resolve() {
  target = null
  const status = await request<UcoordStatus>('status', {})
  for (const [venue, peers] of Object.entries(status?.venues ?? {})) {
    for (const [peer, info] of Object.entries(peers ?? {})) {
      if (info?.state !== 'connected') continue
      target = { venue, peer }
      connection.device = { ...target, model: info.capabilities?.model ?? null }
      return
    }
  }
  throw new Error('no connected device reported by the AP')
}

// Authenticate over the already-open socket; returns the device mode.
export async function login(password: string) {
  const result = await request<{ mode?: 'standalone' | 'ucoord'; modules?: string[] }>('login', {
    password
  })
  connection.mode = result?.mode ?? 'standalone'
  // Null rather than [] when the device says nothing: an empty list means no
  // optional package is installed, which is a different claim.
  connection.modules = Array.isArray(result?.modules) ? result.modules : null
  await target_resolve()
  // ping requires authentication, so the keepalive can only start now.
  keepalive_start()
  return connection.mode
}

// HTTP PUT a file to a one-shot upload URL on the device (see upload.uc);
// resolves to the server's JSON response (incl. file_id) on 201.
export async function upload(upload_url: string, file: Blob): Promise<UploadResult> {
  const res = await fetch(`http://${connection.host}${upload_url}`, { method: 'PUT', body: file })
  let data: UploadResult = {}
  try {
    data = await res.json()
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new Error(data.error || `upload failed (${res.status})`)
  return data
}
