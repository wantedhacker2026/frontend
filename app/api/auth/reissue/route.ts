import { sameOrigin } from '@/lib/auth/session';
import {
  AuthError,
  readCredentials,
  reissueCredentials,
  credentialsResponse,
  clearCredentials,
} from '@/lib/auth/backend';
import { authError } from '@/lib/auth/route-utils';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return authError(new AuthError('허용되지 않은 요청입니다.', 403));
  const data = readCredentials(request);
  if (!data) return clearCredentials(authError(new AuthError('다시 로그인해 주세요.', 401)));
  try {
    if (data.accessExpires > Date.now() + 60000) return credentialsResponse(data);
    return credentialsResponse(await reissueCredentials(data));
  } catch (error) {
    const response = authError(error);
    return response.status === 401 ? clearCredentials(response) : response;
  }
}
