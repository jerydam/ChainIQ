// src/app/api/farcaster/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { optimism } from 'viem/chains';
import { ID_REGISTRY_ADDRESS, idRegistryABI } from '@farcaster/hub-web';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    // Validate that address is a valid Ethereum address
    if (!isAddress(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    const publicClient = createPublicClient({
      chain: optimism,
      transport: http(process.env.NEXT_PUBLIC_OP_PROVIDER_URL || 'https://mainnet.optimism.io'),
    });

    // Fetch FID from ID Registry
    const fid = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'idOf',
      args: [address as `0x${string}`], // Type assertion after validation
    });

    if (fid === BigInt(0)) {
      return NextResponse.json(
        { username: address.slice(0, 6) + '...' + address.slice(-4) },
        { status: 200 }
      );
    }

    // Fetch username via Neynar API
    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json({ error: 'Neynar API key is not set' }, { status: 500 });
    }

    const neynarResponse = await axios.get('https://api.neynar.com/v2/farcaster/user/bulk', {
      params: { fids: Number(fid) },
      headers: { api_key: process.env.NEYNAR_API_KEY },
    });

    const user = neynarResponse.data.users[0];
    const username = user?.username || address.slice(0, 6) + '...' + address.slice(-4);

    return NextResponse.json({ username }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error fetching Farcaster user:', err.message);
    return NextResponse.json({ error: 'Failed to fetch Farcaster user' }, { status: 500 });
  }
}