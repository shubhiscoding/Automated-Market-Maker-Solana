import { NextResponse } from 'next/server';

const CUSTOM_RPC_URL = process.env.SOLANA_RPC;

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  if (!CUSTOM_RPC_URL) {
    console.error("CUSTOM_SOLANA_RPC_URL is not set in environment variables.");
    return NextResponse.json(
      { error: 'RPC endpoint configuration error.' },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const requestBody = await request.json();

    const response = await fetch(CUSTOM_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error from custom RPC endpoint: ${response.status} ${response.statusText}`, errorBody);
      return new Response(errorBody, {
         status: response.status,
         statusText: response.statusText,
         headers: { 
           'Content-Type': response.headers.get('Content-Type') || 'application/json',
           ...corsHeaders
         }
       });
    }

    const responseBody = await response.json();

    return NextResponse.json(responseBody, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in RPC proxy route:', error);
     return NextResponse.json(
       { error: 'Internal Server Error in RPC proxy.' },
       { status: 500, headers: corsHeaders }
     );
  }
}

export async function GET() {
   return NextResponse.json(
     { message: 'RPC Proxy is active. Use POST for requests.' },
     { headers: corsHeaders }
   );
}