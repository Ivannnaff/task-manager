import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function checkAuth(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  const validKey = process.env.BACKEND_API_KEY

  if (!validKey || !apiKey || apiKey !== validKey) return false
  return true
}

export async function getUser(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export function getUserClient(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !key) return null

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401, headers: corsHeaders }
  )
}
