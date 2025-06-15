// app/api/farcaster/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { untrustedData } = body;
    if (!untrustedData) {
      return NextResponse.json({ error: 'Missing untrustedData' }, { status: 400 });
    }

    // Process untrustedData (e.g., fid, buttonIndex, state)
    const { fid, buttonIndex } = untrustedData;
    const userId = `fid:${fid}`;

    // Example response (customize based on webhook needs)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://chainiq.vercel.app/logo.png" />
          <meta property="fc:frame:button:1" content="Continue" />
          <meta property="fc:frame:post_url" content="https://chainiq.vercel.app/api/farcaster/auth" />
        </head>
        <body>
          <h1>Authenticated as ${userId}</h1>
        </body>
      </html>
    `;

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (error: any) {
    console.error('Error in webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}