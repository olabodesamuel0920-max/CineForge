export function getRenderNodeUrl(fallback?: string): string {
  const url = process.env.RENDER_NODE_URL || process.env.NEXT_PUBLIC_RENDER_NODE_URL || fallback;
  if (!url) {
    throw new Error('Render Node URL is not configured. Please set RENDER_NODE_URL or NEXT_PUBLIC_RENDER_NODE_URL in your environment variables.');
  }
  
  let cleaned = url.trim();
  
  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(cleaned)) {
    const isLocalhost = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
    cleaned = (isLocalhost ? 'http://' : 'https://') + cleaned;
  }
  
  let normalized = cleaned;
  try {
    const parsed = new URL(cleaned);
    normalized = parsed.toString().replace(/\/$/, '');
  } catch (e) {
    console.warn(`URL parsing failed for "${cleaned}", falling back to manual replacement:`, e);
    normalized = cleaned.replace(/\/$/, '');
  }
  
  console.log(`[Render Node URL Config] Raw RENDER_NODE_URL: "${process.env.RENDER_NODE_URL || ''}", NEXT_PUBLIC_RENDER_NODE_URL: "${process.env.NEXT_PUBLIC_RENDER_NODE_URL || ''}", Fallback: "${fallback || ''}" -> Normalized: "${normalized}"`);
  
  return normalized;
}
