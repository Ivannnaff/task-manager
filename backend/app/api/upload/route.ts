import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getUser, corsHeaders, unauthorizedResponse } from '@/lib/auth'
import { getClientId, rateLimit, retryAfterSeconds } from '@/lib/rateLimit'

const MAX_FILE_SIZE = 15 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif'])

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: Request) {
  if (!(await getUser(request))) return unauthorizedResponse()

  const limit = rateLimit(`upload:${getClientId(request)}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak unggahan. Coba lagi sebentar.' },
      { status: 429, headers: { ...corsHeaders, 'Retry-After': String(retryAfterSeconds(limit.resetAt)) } }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400, headers: corsHeaders })
    }

    const extension = file.name.toLowerCase().split('.').pop() || ''
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { success: false, error: 'Tipe file tidak didukung' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file maksimal 15MB' },
        { status: 400, headers: corsHeaders }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let extractedText = ''

    const mime = file.type || ''
    const name = file.name.toLowerCase()

    if (mime.includes('image') || name.match(/\.(png|jpg|jpeg|webp)$/)) {
      extractedText = `[File Gambar: ${file.name}]`
    } else if (mime.includes('pdf') || name.endsWith('.pdf')) {
      extractedText = `[File PDF: ${file.name}]`
    } else if (
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      name.endsWith('.pptx') ||
      name.endsWith('.xlsx')
    ) {
      try {
        const officeparser = await import('officeparser')
        const result = await officeparser.parseOffice(buffer)
        extractedText = typeof result === 'string' ? result : JSON.stringify(result)
      } catch (err: any) {
        extractedText = `[Gagal parsing file office: ${err.message}]`
      }
    } else {
      extractedText = buffer.toString('utf-8')
    }

    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('materials')
      .upload(safeName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    let publicUrl = ''
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from('materials').getPublicUrl(uploadData.path)
      publicUrl = urlData.publicUrl
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          fileName: file.name,
          url: publicUrl,
          type: file.type || 'unknown',
          text: extractedText,
        },
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
  }
}

