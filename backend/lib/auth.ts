import { NextResponse } from 'next/server'
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
