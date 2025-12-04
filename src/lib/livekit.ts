import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL!;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

export const livekitConfig = {
  wsUrl: LIVEKIT_WS_URL,
  apiKey: LIVEKIT_API_KEY,
  apiSecret: LIVEKIT_API_SECRET,
};

export interface TokenRequest {
  roomName: string;
  participantName: string;
  identity: string;
  role?: 'host' | 'participant' | 'viewer';
}

export interface TokenResponse {
  token: string;
  url: string;
}

export async function generateToken(request: TokenRequest): Promise<TokenResponse> {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: request.identity,
    name: request.participantName,
  });

  let grant: any = {
    room: request.roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublishData: true,
  };

  if (request.role === 'host') {
    grant = { ...grant, roomAdmin: true, canPublish: true };
  } else if (request.role === 'participant') {
    grant = { ...grant, canPublish: true };
  } else {
    grant = { ...grant, canPublish: false, canPublishData: false };
  }

  at.addGrant(grant);

  const token = await at.toJwt();

  return Promise.resolve({
    token,
    url: LIVEKIT_WS_URL,
  });
}
