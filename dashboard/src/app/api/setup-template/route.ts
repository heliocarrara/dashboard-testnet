
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const setupScriptPath = path.join(process.cwd(), '../setup-node.sh');
    
    if (!fs.existsSync(setupScriptPath)) {
        return NextResponse.json({ error: 'setup-node.sh not found' }, { status: 404 });
    }

    const content = fs.readFileSync(setupScriptPath, 'utf-8');

    // Extract Docker Compose template
    const composeRegex = /cat > docker-compose\.yml <<EOF\n([\s\S]*?)EOF/;
    const composeMatch = content.match(composeRegex);

    if (!composeMatch) {
      return NextResponse.json({ error: 'Docker Compose template not found in setup script' }, { status: 500 });
    }

    const template = composeMatch[1];

    // Extract variables defined in the script (simple regex for VAR="value")
    const variables: Record<string, string> = {};
    const varRegex = /^([A-Z_]+)="([^"]+)"/gm;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
        variables[match[1]] = match[2];
    }
    
    // Also extract variables without quotes if needed (e.g., VAR=value)
    const varRegexNoQuotes = /^([A-Z_]+)=([^\s"']+)/gm;
    while ((match = varRegexNoQuotes.exec(content)) !== null) {
        if (!variables[match[1]]) {
            variables[match[1]] = match[2];
        }
    }

    return NextResponse.json({ template, variables });
  } catch (error) {
    console.error('Failed to read setup script:', error);
    return NextResponse.json({ error: 'Failed to read setup script' }, { status: 500 });
  }
}
