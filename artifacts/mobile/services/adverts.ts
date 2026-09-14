import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { reportOperationalFailure } from '@/observability/monitoring';

// GET /v1/adverts/active — driver dashboard banner carousel. This is a
// PUBLIC route (registered outside the authenticated group in main.go), so a
// missing/expired access token is harmless: the shared client omits the
// Authorization header when there is no token, and every failure path below
// (network, non-2xx, malformed body) still resolves to `[]` rather than
// throwing — a banner that fails to load must never blank the rest of the
// driver dashboard.

export type ActiveAdvert = {
  id: string;
  partner_id: string;
  image_url: string | null;
  headline: string;
  cta_label: string;
  cta_link: string;
  priority: number;
};

// The backend has shipped both snake_case and camelCase field names for this
// endpoint at different points — accept either without assuming which one is
// live today.
interface RawActiveAdvertDto {
  id: string;
  partner_id?: string | null;
  partnerId?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  headline?: string | null;
  cta_label?: string | null;
  ctaLabel?: string | null;
  cta_link?: string | null;
  ctaLink?: string | null;
  priority?: number | null;
}

interface ActiveAdvertsResponseDto {
  data: RawActiveAdvertDto[] | null;
}

function toActiveAdvert(item: RawActiveAdvertDto): ActiveAdvert {
  return {
    id: item.id,
    partner_id: item.partner_id || item.partnerId || '',
    image_url: item.image_url || item.imageUrl || null,
    headline: item.headline || '',
    cta_label: item.cta_label || item.ctaLabel || '',
    cta_link: item.cta_link || item.ctaLink || '',
    priority: item.priority || 1,
  };
}

export async function fetchActiveAdverts(): Promise<ActiveAdvert[]> {
  try {
    // Routed through the app's own backend client — same baseUrl resolution
    // every other service uses (see services/profile.ts) — instead of
    // hand-rolling the URL. That's what used to drop the "/v1" segment
    // against the staging env var and silently 404 the whole banner.
    const client = getAppBackendClient();
    const response = await client.get<ActiveAdvertsResponseDto>('/v1/adverts/active');
    const rawList = response.data?.data ?? [];
    return rawList.map(toActiveAdvert);
  } catch (err) {
    // Visible in Sentry/logs now instead of a silent `return []` — the next
    // time this 404s or times out, it shows up instead of just looking like
    // an empty adverts table.
    reportOperationalFailure('adverts.fetchActive', err);
    return [];
  }
}

// Backend images are served from GET /api/v1/uploads/objects/*, at the same
// origin as every other backend call. Origin/host are derived from the app's
// own client config — no hardcoded host/IP anywhere below.
export function resolveBackendImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('data:')) return rawUrl;

  const baseUrl = getAppBackendClient().baseUrl;
  let origin: string;
  let host: string;
  try {
    const parsed = new URL(baseUrl);
    origin = parsed.origin;
    host = parsed.hostname;
  } catch {
    // baseUrl is validated when the client is constructed
    // (resolveBackendTransportConfig); this only trips when the backend is
    // disabled and there's nowhere to resolve a relative/rewritten path
    // against — an already-absolute URL still works as-is, anything else
    // can't be resolved.
    return rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : null;
  }

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    // A container-internal hostname (MinIO's own localhost/minio URL, as
    // opposed to the origin the app is actually configured against — e.g. a
    // developer's LAN IP in local dev) is only reachable from the machine
    // running the backend. Rewrite it to the host the app is already talking
    // to so a physical device can actually load the image.
    if (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1') || rawUrl.includes('minio')) {
      const match = rawUrl.match(/(?::\d+|\/\/localhost|\/\/127\.0\.0\.1)\/+(.+)$/);
      if (match && match[1]) {
        const pathPart = match[1].startsWith('api/v1/')
          ? match[1]
          : `api/v1/uploads/objects/${match[1].replace(/^uploads\/objects\//, '')}`;
        return `${origin}/${pathPart}`;
      }
      return rawUrl.replace(/localhost|127\.0\.0\.1|minio/g, host);
    }
    // Already absolute and not a container-internal host (e.g. a signed
    // object-storage URL) — use as-is.
    return rawUrl;
  }

  const cleanPath = rawUrl.replace(/^\/+/, '');
  if (cleanPath.startsWith('api/v1/')) {
    return `${origin}/${cleanPath}`;
  }
  return `${origin}/api/v1/uploads/objects/${cleanPath}`;
}
