const HOST = 'http://120.55.70.218:8100';
const API_V2_BASE = import.meta.env.VITE_API_BASE_URL || `${HOST}/api/v2`;
const API_V3_BASE = import.meta.env.VITE_API_V3_BASE_URL || `${HOST}/api/v3`;

function buildUrl(path: string, version: 'v2' | 'v3' = 'v2') {
  if (path.startsWith('http')) return path;
  if (path.startsWith('/api/')) return `${HOST}${path}`;
  return `${version === 'v3' ? API_V3_BASE : API_V2_BASE}${path}`;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path, 'v2'));
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text().catch(()=> '')}`);
  return (await res.json()) as T;
}
export async function apiGetV3<T = any>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path, 'v3'));
  if (!res.ok) throw new Error(`GET V3 ${path} failed: ${res.status} ${await res.text().catch(()=> '')}`);
  return (await res.json()) as T;
}
export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path, 'v2'), {method:'POST', headers:{'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(buildUrl(path, 'v2'), {method:'POST', body: formData});
  if (!res.ok) throw new Error(`UPLOAD ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
