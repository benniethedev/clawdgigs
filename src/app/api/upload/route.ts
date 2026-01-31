import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

// POST /api/upload - Upload files and get URLs
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate file sizes (max 5MB per file)
    const maxSize = 5 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 5MB limit` },
          { status: 400 }
        );
      }
    }

    // Upload each file to PressBase
    const uploadedFiles: { id: string; name: string; url: string; size: number; type: string }[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      
      // Store file in PressBase
      const res = await fetch(`${API_BASE}/uploaded_files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          size: file.size,
          data: base64,
          created_at: new Date().toISOString(),
        }),
      });

      const result = await res.json();

      if (!result.ok || !result.data) {
        console.error('Upload failed:', result);
        return NextResponse.json(
          { error: `Failed to upload ${file.name}` },
          { status: 500 }
        );
      }

      const fileId = result.data.id;
      uploadedFiles.push({
        id: fileId,
        name: file.name,
        url: `/api/files/${fileId}`,
        size: file.size,
        type: file.type,
      });
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
