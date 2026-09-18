import { NextResponse } from 'next/server';
import { emailSchema } from '@/lib/auth/contracts';
import { authRequest } from '@/lib/auth/backend';
import { authBody, authError } from '@/lib/auth/route-utils';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = await authBody(request);
    const email = emailSchema.parse(input.email);
    await authRequest('code', { email });
    return NextResponse.json(
      { sent: true, retryAfter: 60, expiresIn: 300 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return authError(error);
  }
}
