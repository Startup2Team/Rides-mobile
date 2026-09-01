export type ActiveAdvert = {
  id: string;
  partner_id: string;
  image_url: string | null;
  headline: string;
  cta_label: string;
  cta_link: string;
  priority: number;
};

export async function fetchActiveAdverts(): Promise<ActiveAdvert[]> {
  try {
    const baseUrl = (
      process.env.EXPO_PUBLIC_BACKEND_BASE_URL ??
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      'http://192.168.1.72:8080/api/v1'
    ).replace(/\/+$/, '');
    const url = `${baseUrl}/adverts/active`;
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    const rawList = json.data ?? [];
    return rawList.map((item: any) => ({
      id: item.id,
      partner_id: item.partner_id || item.partnerId || '',
      image_url: item.image_url || item.imageUrl || null,
      headline: item.headline || '',
      cta_label: item.cta_label || item.ctaLabel || '',
      cta_link: item.cta_link || item.ctaLink || '',
      priority: item.priority || 1,
    }));
  } catch (err) {
    console.warn('[ADVERTS] Failed to fetch active advert banners from backend:', err);
    return [];
  }
}

export function resolveBackendImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  const base = (
    process.env.EXPO_PUBLIC_BACKEND_BASE_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'http://192.168.1.72:8080/api/v1'
  ).replace(/\/+$/, '');

  let backendHost = '192.168.1.72';
  let backendOrigin = 'http://192.168.1.72:8080';

  try {
    const parsed = new URL(base);
    backendHost = parsed.hostname;
    backendOrigin = parsed.origin;
  } catch {}

  // If rawUrl is an absolute URL containing localhost or 127.0.0.1 or minio, replace with computer LAN IP
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    if (
      rawUrl.includes('localhost') ||
      rawUrl.includes('127.0.0.1') ||
      rawUrl.includes('minio')
    ) {
      const match = rawUrl.match(/(?::8080|:9000|\/\/localhost|\/\/127\.0\.0\.1)\/+(.+)$/);
      if (match && match[1]) {
        const pathPart = match[1].startsWith('api/v1/')
          ? match[1]
          : `api/v1/uploads/objects/${match[1].replace(/^uploads\/objects\//, '')}`;
        return `${backendOrigin}/${pathPart}`;
      }
      return rawUrl.replace(/localhost|127\.0\.0\.1|minio/g, backendHost);
    }
    return rawUrl;
  }

  if (rawUrl.startsWith('data:')) {
    return rawUrl;
  }

  const cleanPath = rawUrl.replace(/^\/+/, '');
  if (cleanPath.startsWith('api/v1/')) {
    return `${backendOrigin}/${cleanPath}`;
  }
  return `${base}/uploads/objects/${cleanPath}`;
}
