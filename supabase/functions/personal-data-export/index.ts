import 'jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts'
import { strToU8, zipSync } from 'npm:fflate@0.8.2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'personal-data-exports'
const EXPORT_TTL_HOURS = 72
// The Edge Function has a 256 MB memory ceiling. Keep enough headroom for
// database JSON, ZIP metadata, compression buffers, and the final archive.
const MAX_RAW_FILE_BYTES = 64 * 1024 * 1024

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Explicit allowlists prevent a future internal/admin column from being
// exported merely because it was added to a user-owned table.
const USER_TABLES = {
  affiliate_clicks: 'id,user_id,sake_id,drinking_record_id,provider,shop_name,product_title,destination_url,created_at',
  ai_recognition_usage: 'id,user_id,used_at,plan_at_use,source',
  corrections: 'id,user_id,recognition_result_id,predicted_brand,predicted_product,correct_brand,correct_product,correct_brewery,reason,created_at',
  drinking_records: 'id,user_id,sake_id,brand_name,product_name,brewery_name,drank_at,restaurant_name,restaurant_address,latitude,longitude,price_yen,rating,aroma,sweetness,acidity,umami,comment,is_favorite,created_at,updated_at,dryness,body,finish,serving_temperature,pairing_food,prefecture,classification,rice,polishing_ratio,alcohol,volume,rice_variety,place_type,serving_temperature_c,companion_name,event_id,client_request_id',
  event_access_members: 'event_id,user_id,granted_at,revoked_at',
  event_flyer_submissions: 'id,user_id,image_path,extracted,submitter_edits,source_urls,status,confirmed_event_id,created_at,updated_at,reviewed_at',
  event_participations: 'id,event_id,user_id,status,checked_in_at,note,created_at,updated_at',
  event_photos: 'id,event_id,user_id,storage_path,caption,moderation_status,face_review_status,is_public,created_at,audience,face_policy,uploaded_by_participant,deletion_requested_at,deletion_request_reason,client_request_id',
  favorites: 'id,user_id,sake_id,created_at',
  line_account_links: 'line_sub_hash,user_id,created_at,updated_at',
  maker_voices: 'id,user_id,sake_master_id,brewery_name,sake_name,message,age_band,gender,residence_prefecture,drinking_place,share_age_band,share_gender,share_residence,share_drinking_place,moderation_status,delivery_status,delivered_at,created_at',
  menu_scans: 'id,user_id,restaurant_name,latitude,longitude,storage_path,ocr_text,status,model_name,processing_ms,created_at',
  recognition_results: 'id,user_id,drinking_record_id,photo_id,ocr_text,predicted_brand,predicted_product,predicted_brewery,confidence,candidates,web_sources,sakenowa_brand_id,processing_ms,model_name,created_at',
  recommendations: 'id,user_id,sake_id,recommended_brand,recommended_product,recommended_brewery,recommendation_type,score,reason,model_name,was_opened,was_saved,was_purchased,created_at',
  sake_dictionary_signatures: 'id,user_id,front_hash,back_hash,brand_name,product_name,brewery_name,prefecture,classification,ingredients,rice_variety,polishing_ratio,alcohol,volume,created_at,confirmed_count',
  sake_photos: 'id,user_id,drinking_record_id,photo_type,storage_path,mime_type,width,height,created_at',
  taste_profiles: 'id,user_id,sweetness,acidity,umami,aroma,dryness,body,finish,profile_label,ai_summary,source_record_count,calculated_at,created_at,updated_at',
  user_badges: 'id,user_id,badge_id,earned_at',
  user_preferences: 'user_id,notifications_enabled,recommendation_enabled,location_enabled,analytics_consent,currency_code,distance_unit,created_at,updated_at',
} as const

const PROFILE_COLUMNS = 'id,display_name,avatar_url,plan,created_at,updated_at,preferred_language,country_code,onboarding_completed'

type ExportRequest = {
  id: string
  reference_code: string
  user_id: string
  status: string
  storage_path: string | null
  expires_at: string | null
  requested_at: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('apikey', SERVICE_KEY)
  headers.set('Authorization', `Bearer ${SERVICE_KEY}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers })
}

async function verifyUser(req: Request) {
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED')
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: authorization },
  })
  if (!response.ok) throw new Error('AUTH_INVALID')
  return await response.json()
}

async function rows(table: string, userId: string, key = 'user_id', select = '*') {
  const query = new URLSearchParams({ select, [key]: `eq.${userId}` })
  const response = await api(`/rest/v1/${table}?${query}`)
  if (!response.ok) throw new Error(`READ_${table.toUpperCase()}_${response.status}`)
  return await response.json() as Record<string, unknown>[]
}

function csvCell(value: unknown) {
  if (value == null) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function toCsv(data: Record<string, unknown>[]) {
  if (!data.length) return ''
  const columns = [...new Set(data.flatMap((row) => Object.keys(row)))]
  return [columns.map(csvCell).join(','), ...data.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\r\n')
}

function safeArchivePath(path: string) {
  return path.split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
}

async function updateRequest(id: string, patch: Record<string, unknown>) {
  const response = await api(`/rest/v1/personal_data_export_requests?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`UPDATE_REQUEST_${response.status}`)
  return (await response.json())[0] as ExportRequest
}

async function getRequest(userId: string, id?: string) {
  const query = new URLSearchParams({
    select: '*',
    user_id: `eq.${userId}`,
    order: 'requested_at.desc',
    limit: '1',
  })
  if (id) query.set('id', `eq.${id}`)
  const response = await api(`/rest/v1/personal_data_export_requests?${query}`)
  if (!response.ok) throw new Error(`READ_REQUEST_${response.status}`)
  return ((await response.json()) as ExportRequest[])[0] ?? null
}

async function downloadStorageObject(bucket: string, path: string) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const response = await api(`/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`)
  if (!response.ok) throw new Error(`READ_STORAGE_${bucket}_${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function generateExport(request: ExportRequest, user: Record<string, unknown>) {
  try {
    await updateRequest(request.id, { status: 'preparing', preparing_at: new Date().toISOString(), error_code: null })

    const payload: Record<string, Record<string, unknown>[]> = {}
    payload.profiles = await rows('profiles', request.user_id, 'id', PROFILE_COLUMNS)
    for (const [table, select] of Object.entries(USER_TABLES)) {
      payload[table] = await rows(table, request.user_id, 'user_id', select)
    }

    const safeAccount = {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      providers: (user.app_metadata as Record<string, unknown> | undefined)?.providers ?? [],
    }

    const zipEntries: Record<string, Uint8Array> = {
      'README.txt': strToU8('和酒ログ 個人データ開示ファイル\n文字コード: UTF-8\n'),
      'account.json': strToU8(JSON.stringify(safeAccount, null, 2)),
    }

    for (const [table, tableRows] of Object.entries(payload)) {
      zipEntries[`data/${table}.json`] = strToU8(JSON.stringify(tableRows, null, 2))
      zipEntries[`data/${table}.csv`] = strToU8(toCsv(tableRows))
    }

    const fileRefs: Array<{ bucket: string; path: string; category: string }> = []
    for (const row of payload.sake_photos ?? []) if (typeof row.storage_path === 'string') fileRefs.push({ bucket: 'sake-photos', path: row.storage_path, category: 'sake-photos' })
    for (const row of payload.event_photos ?? []) if (typeof row.storage_path === 'string') fileRefs.push({ bucket: 'event-photos', path: row.storage_path, category: 'event-photos' })
    for (const row of payload.menu_scans ?? []) if (typeof row.storage_path === 'string') fileRefs.push({ bucket: 'sake-photos', path: row.storage_path, category: 'menu-scans' })
    for (const row of payload.event_flyer_submissions ?? []) if (typeof row.image_path === 'string') fileRefs.push({ bucket: 'event-flyers', path: row.image_path, category: 'event-flyers' })

    let rawFileBytes = 0
    const missingFiles: Array<{ bucket: string; path: string; reason: string }> = []
    for (const file of fileRefs) {
      try {
        const bytes = await downloadStorageObject(file.bucket, file.path)
        rawFileBytes += bytes.byteLength
        if (rawFileBytes > MAX_RAW_FILE_BYTES) throw new Error('EXPORT_TOO_LARGE')
        zipEntries[`files/${file.category}/${safeArchivePath(file.path)}`] = bytes
      } catch (error) {
        if (error instanceof Error && error.message === 'EXPORT_TOO_LARGE') throw error
        missingFiles.push({ bucket: file.bucket, path: file.path, reason: error instanceof Error ? error.message : 'UNKNOWN' })
      }
    }

    const generatedAt = new Date()
    const manifest = {
      service: '和酒ログ',
      reference_code: request.reference_code,
      generated_at: generatedAt.toISOString(),
      format_version: 1,
      tables: Object.fromEntries(Object.entries(payload).map(([name, data]) => [name, data.length])),
      included_files: fileRefs.length - missingFiles.length,
      missing_files: missingFiles,
      exclusions: ['password_hashes', 'session_tokens', 'security_secrets', 'other_users_data', 'internal_moderation_notes'],
    }
    zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

    const current = await getRequest(request.user_id, request.id)
    if (!current || current.status === 'cancelled') return

    const archive = zipSync(zipEntries, { level: 6 })
    const digest = await crypto.subtle.digest('SHA-256', archive)
    const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const storagePath = `${request.user_id}/${request.id}/${request.reference_code}.zip`
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
    const upload = await api(`/storage/v1/object/${BUCKET}/${encodedPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip', 'x-upsert': 'false' },
      body: archive,
    })
    if (!upload.ok) throw new Error(`UPLOAD_${upload.status}`)

    const afterUpload = await getRequest(request.user_id, request.id)
    if (!afterUpload || afterUpload.status === 'cancelled') {
      await api(`/storage/v1/object/${BUCKET}/${encodedPath}`, { method: 'DELETE' })
      return
    }

    const readyAt = new Date()
    const expiresAt = new Date(readyAt.getTime() + EXPORT_TTL_HOURS * 60 * 60 * 1000)
    await updateRequest(request.id, {
      status: 'ready',
      storage_path: storagePath,
      file_size_bytes: archive.byteLength,
      file_sha256: sha256,
      ready_at: readyAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
  } catch (error) {
    const current = await getRequest(request.user_id, request.id).catch(() => null)
    if (current?.status === 'cancelled') return
    await updateRequest(request.id, {
      status: 'failed',
      error_code: error instanceof Error ? error.message.slice(0, 120) : 'UNKNOWN',
    }).catch(() => undefined)
  }
}

async function createRequest(user: Record<string, unknown>) {
  const userId = String(user.id)
  const existing = await getRequest(userId)
  if (existing && ['requested', 'preparing', 'ready', 'downloaded'].includes(existing.status)) return existing

  const response = await api('/rest/v1/personal_data_export_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (response.status === 409) return await getRequest(userId)
  if (!response.ok) throw new Error(`CREATE_REQUEST_${response.status}`)
  const created = (await response.json())[0] as ExportRequest
  EdgeRuntime.waitUntil(generateExport(created, user))
  return created
}

async function createDownloadUrl(request: ExportRequest) {
  if (!request.storage_path || !['ready', 'downloaded'].includes(request.status)) throw new Error('NOT_READY')
  if (!request.expires_at || new Date(request.expires_at).getTime() <= Date.now()) {
    await updateRequest(request.id, { status: 'expired' })
    throw new Error('EXPIRED')
  }
  const encodedPath = request.storage_path.split('/').map(encodeURIComponent).join('/')
  const response = await api(`/storage/v1/object/sign/${BUCKET}/${encodedPath}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: 300 }),
  })
  if (!response.ok) throw new Error(`SIGN_${response.status}`)
  const data = await response.json()
  const now = new Date().toISOString()
  await updateRequest(request.id, {
    status: 'downloaded',
    first_download_url_issued_at: request.status === 'ready' ? now : undefined,
    downloaded_at: now,
  })
  return { download_url: `${SUPABASE_URL}/storage/v1${data.signedURL}`, expires_in_seconds: 300 }
}

async function expireRequest(request: ExportRequest) {
  if (request.storage_path) {
    const encodedPath = request.storage_path.split('/').map(encodeURIComponent).join('/')
    const removal = await api(`/storage/v1/object/${BUCKET}/${encodedPath}`, { method: 'DELETE' })
    if (!removal.ok && removal.status !== 404) throw new Error(`DELETE_EXPIRED_EXPORT_${removal.status}`)
  }
  return await updateRequest(request.id, {
    status: 'expired',
    storage_path: null,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const user = await verifyUser(req)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = String(body.action ?? new URL(req.url).searchParams.get('action') ?? 'status')

    if (action === 'create') return json({ request: await createRequest(user) }, 202)

    const current = await getRequest(String(user.id), typeof body.request_id === 'string' ? body.request_id : undefined)
    if (!current) return json({ request: null })

    if (
      ['ready', 'downloaded'].includes(current.status) &&
      current.expires_at &&
      new Date(current.expires_at).getTime() <= Date.now()
    ) {
      const expired = await expireRequest(current)
      return json({ request: expired })
    }

    if (action === 'cancel') {
      if (!['requested', 'preparing'].includes(current.status)) return json({ error: 'CANNOT_CANCEL', request: current }, 409)
      return json({ request: await updateRequest(current.id, { status: 'cancelled', cancelled_at: new Date().toISOString() }) })
    }
    if (action === 'download') return json({ request: current, ...(await createDownloadUrl(current)) })
    return json({ request: current })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    const status = code.startsWith('AUTH_') ? 401 : code === 'NOT_READY' || code === 'EXPIRED' ? 409 : 500
    return json({ error: code }, status)
  }
})

