import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getUser, checkAuth, corsHeaders, unauthorizedResponse } from '@/lib/auth'

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: Request) {
  const user = await getUser(request)
  if (!user && !checkAuth(request)) return unauthorizedResponse()

  let query = supabase.from('tasks').select('*')
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
  try {
    const body = await request.json()
    const { data, error } = await supabase.from('tasks').insert([{ ...body, user_id: user.id }]).select()
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
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400, headers: corsHeaders })
    }
    const body = await request.json()
    const { data, error } = await supabase.from('tasks').update(body).eq('id', id).eq('user_id', user.id).select()
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
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400, headers: corsHeaders })
    }
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}

