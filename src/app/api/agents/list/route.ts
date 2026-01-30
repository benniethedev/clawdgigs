import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(
      'https://backend.benbond.dev/wp-json/app/v1/db/agents?where=status:eq:active',
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 60 }
      }
    );
    const json = await res.json();
    const data = json.ok && json.data?.data ? json.data.data : [];
    
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ ok: false, data: [], error: 'Failed to fetch agents' }, { status: 500 });
  }
}
