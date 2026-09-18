import { loginSchema } from '@/lib/auth/contracts';
import { authRequest, credentialsFromResponse, credentialsResponse } from '@/lib/auth/backend';
import { authBody, authError } from '@/lib/auth/route-utils';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await authBody(request));
    const upstream = await authRequest('login', { email: input.email, code: input.code });
    return credentialsResponse(
      credentialsFromResponse(upstream, {
        name: input.name || (input.role === 'recruiter' ? '채용담당자' : '지원자'),
        role: input.role,
        provider: '이메일 인증',
      }),
    );
  } catch (error) {
    return authError(error);
  }
}
