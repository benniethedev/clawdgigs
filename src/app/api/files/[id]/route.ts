import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

// GET /api/files/[id] - Download a file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch file from PressBase
    const res = await fetch(`${API_BASE}/uploaded_files?where=id:eq:${id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
      },
      cache: 'no-store',
    });

    const result = await res.json();

    if (!result.ok || !result.data?.data?.[0]) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const file = result.data.data[0];
    const buffer = Buffer.from(file.data, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.content_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}
