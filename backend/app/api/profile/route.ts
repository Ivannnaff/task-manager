import { NextResponse } from 'next/server'
import { getUser, getUserClient, corsHeaders, unauthorizedResponse } from '@/lib/auth'

function dbError() {
  return NextResponse.json(
    { success: false, error: 'Database client tidak tersedia' },
    { status: 500, headers: corsHeaders }
  )
}

function validNumber(value: unknown) {
  return typeof value === 'string' && /^62\d{8,15}$/.test(value)
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: Request) {
  const user = await getUser(request)
  if (!user) return unauthorizedResponse()
  const db = getUserClient(request)
  if (!db) return dbError()

  const { data, error } = await db
    .from('profiles')
    .select('whatsapp_number, notifications_enabled, verified_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
  }

  return NextResponse.json({
    success: true,
    data: data || { whatsapp_number: null, notifications_enabled: true, verified_at: null },
  }, { headers: corsHeaders })
}

export async function PATCH(request: Request) {
  const user = await getUser(request)
  if (!user) return unauthorizedResponse()
  const db = getUserClient(request)
  if (!db) return dbError()

  try {
    const body = await request.json()
    const raw = typeof body.whatsapp_number === 'string' ? body.whatsapp_number.trim() : ''
    const whatsappNumber = raw === '' ? null : raw.replace(/[\s-]/g, '')
    const enabled = body.notifications_enabled !== false

    if (whatsappNumber && !validNumber(whatsappNumber)) {
      return NextResponse.json(
        { success: false, error: 'Nomor harus format 628xxxxxxxxxx' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { data, error } = await db
      .from('profiles')
      .upsert({
        user_id: user.id,
        whatsapp_number: whatsappNumber,
        notifications_enabled: enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('whatsapp_number, notifications_enabled, verified_at')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
    }
    return NextResponse.json({ success: true, data }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}
