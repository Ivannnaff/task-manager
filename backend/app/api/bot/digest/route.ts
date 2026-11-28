import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkAuth, corsHeaders, unauthorizedResponse } from '@/lib/auth'

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorizedResponse()
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Service role belum tersedia' },
      { status: 500, headers: corsHeaders }
    )
  }

  const [{ data: tasks, error: taskError }, { data: profiles, error: profileError }] = await Promise.all([
    supabaseAdmin.from('tasks').select('id, title, description, deadline, status, user_id'),
    supabaseAdmin.from('profiles').select('user_id, whatsapp_number, notifications_enabled'),
  ])

  if (taskError || profileError) {
    return NextResponse.json(
      { success: false, error: (taskError || profileError)?.message },
      { status: 500, headers: corsHeaders }
    )
  }

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))
  const grouped = new Map<string, any>()

  for (const task of tasks || []) {
    if (task.status === 'completed' || !task.deadline) continue
    const profile = profileMap.get(task.user_id)
    if (!profile?.whatsapp_number || profile.notifications_enabled === false) continue

    if (!grouped.has(task.user_id)) {
      grouped.set(task.user_id, {
        userId: task.user_id,
        whatsappNumber: profile.whatsapp_number,
        tasks: [],
      })
    }
    grouped.get(task.user_id).tasks.push({
      id: task.id,
      title: task.title,
      description: task.description,
      deadline: task.deadline,
      status: task.status,
    })
  }

  return NextResponse.json(
    { success: true, data: { users: Array.from(grouped.values()) } },
    { headers: corsHeaders }
  )
}
