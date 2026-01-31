import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

interface FileRecord {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  data: string; // base64 encoded file data
  created_at: string;
}

// Helper to flatten PressBase schemaless records
function flattenRecord(record: Record<string, unknown> | null): FileRecord | null {
  if (!record) return null;
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const { data, ...topLevel } = record;
    return { ...topLevel, ...(data as Record<string, unknown>) } as unknown as FileRecord;
  }
  return record as unknown as FileRecord;
}

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

    const rawRecord = result.data.data[0];
    const file = flattenRecord(rawRecord);

    if (!file || !file.data) {
      return NextResponse.json(
        { error: 'File data not found' },
        { status: 404 }
      );
    }

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
