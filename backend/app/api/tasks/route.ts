import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getUser, getUserClient, checkAuth, corsHeaders, unauthorizedResponse } from '@/lib/auth'
import { rateLimit, retryAfterSeconds } from '@/lib/rateLimit'

function dbError() {
  return NextResponse.json(
    { success: false, error: 'Database client tidak tersedia' },
    { status: 500, headers: corsHeaders }
  )
}

function writeLimit(userId: string) {
  const limit = rateLimit(`tasks-write:${userId}`, 60, 60_000)
  if (limit.ok) return null
  return NextResponse.json(
    { success: false, error: 'Terlalu banyak perubahan. Coba lagi sebentar.' },
    { status: 429, headers: { ...corsHeaders, 'Retry-After': String(retryAfterSeconds(limit.resetAt)) } }
  )
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: Request) {
  const user = await getUser(request)
  const isService = !user && checkAuth(request)
  if (!user && !isService) return unauthorizedResponse()

  const db = user ? getUserClient(request) : supabaseAdmin
  if (!db) return dbError()

  let query = db.from('tasks').select('*')
  if (user) query = query.eq('user_id', user.id)
  const { data, error } = await query.order('id', { ascending: false })
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
  }
  return NextResponse.json({ success: true, data }, { headers: corsHeaders })
}

export async function POST(request: Request) {
  const user = await getUser(request)
  if (!user) return unauthorizedResponse()
  const limited = writeLimit(user.id)
  if (limited) return limited
  const db = getUserClient(request)
  if (!db) return dbError()

  try {
    const body = await request.json()
    const { data, error } = await db.from('tasks').insert([{ ...body, user_id: user.id }]).select()
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
    }
    return NextResponse.json({ success: true, data }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}

export async function PATCH(request: Request) {
  const user = await getUser(request)
  if (!user) return unauthorizedResponse()
  const limited = writeLimit(user.id)
  if (limited) return limited
  const db = getUserClient(request)
  if (!db) return dbError()

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400, headers: corsHeaders })
    }
    const body = await request.json()
    const { data, error } = await db.from('tasks').update(body).eq('id', id).eq('user_id', user.id).select()
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
    }
    return NextResponse.json({ success: true, data }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}

export async function DELETE(request: Request) {
  const user = await getUser(request)
  if (!user) return unauthorizedResponse()
  const limited = writeLimit(user.id)
  if (limited) return limited
  const db = getUserClient(request)
  if (!db) return dbError()

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400, headers: corsHeaders })
    }
    const { error } = await db.from('tasks').delete().eq('id', id).eq('user_id', user.id)
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}
