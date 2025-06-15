import { NextRequest, NextResponse } from 'next/server';
import { hexToBytes } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { untrustedData } = body;
    if (!untrustedData) {
      return NextResponse.json({ error: 'Missing untrustedData' }, { status: 400 });
    }

    const { fid, buttonIndex, state: serializedState } = untrustedData;
    const userId = `fid:${fid}`;

    // Process webhook event (e.g., button click)
    let html: string;
    if (buttonIndex === 1) {
      // Example: Handle "Continue" or initial auth
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="https://chainiq.vercel.app/logo.png" />
            <meta property="fc:frame:button:1" content="Next Step" />
            <meta property="fc:frame:post_url" content="https://chainiq.vercel.app/api/farcaster/auth" />
            <meta property="fc:frame:state" content="${encodeURIComponent(JSON.stringify({ userId, step: 1 }))}" />
          </head>
          <body>
            <h1>Welcome ${userId}</h1>
            <p>Proceeding to next step...</p>
          </body>
        </html>
      `;
    } else {
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="https://chainiq.vercel.app/splash.png" />
            <meta property="fc:frame:button:1" content="Back to Home" />
            <meta property="fc:frame:button:1:action" content="link" />
            <meta property="fc:frame:button:1:target" content="https://chainiq.vercel.app" />
          </head>
          <body>
            <h1>Authentication Complete</h1>
          </body>
        </html>
      `;
    }

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (error: any) {
    console.error('Error in webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}