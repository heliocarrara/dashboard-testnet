
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), '../lab-map.json');

export async function GET() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(data));
    }
    // Default configuration if file doesn't exist
    return NextResponse.json({ rows: 3, machinesPerRow: 6, machines: [] });
  } catch (error) {
    console.error('Failed to read lab map data:', error);
    return NextResponse.json({ error: 'Failed to read lab map data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate data structure (basic validation)
    if (!data.rows || !data.machinesPerRow || !Array.isArray(data.machines)) {
       return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save lab map data:', error);
    return NextResponse.json({ error: 'Failed to save lab map data' }, { status: 500 });
  }
}
