import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const templatePath = join(process.cwd(), 'backup-cooperbenjamin222-template.xlsx')
    const fileBuffer = await readFile(templatePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="task-backup-template.xlsx"',
      },
    })
  } catch (e: any) {
    console.error('GET /api/backup/template error:', e)
    return NextResponse.json({ error: 'Template file not found' }, { status: 404 })
  }
}

