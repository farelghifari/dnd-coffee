import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: Request) {
  try {
    const data = await request.formData()
    const file: File | null = data.get('file') as unknown as File
    const folder: string | null = data.get('folder') as unknown as string
    const filename: string | null = data.get('filename') as unknown as string

    if (!file || !folder || !filename) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: file, folder, filename' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = join(process.cwd(), 'public', 'resources', folder)
    
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true })
    
    const path = join(uploadDir, filename)
    await writeFile(path, buffer)
    
    // Return the public-facing URL path
    return NextResponse.json({ 
      success: true, 
      path: `/resources/${folder}/${filename}` 
    })
  } catch (error) {
    console.error('Upload Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error during upload' },
      { status: 500 }
    )
  }
}
