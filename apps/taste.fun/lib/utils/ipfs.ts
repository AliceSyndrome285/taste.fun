/**
 * IPFS utility functions for converting URIs to accessible URLs
 */

/**
 * Convert IPFS URI to gateway URL
 * @param ipfsUri - IPFS URI (e.g., "ipfs://QmHash" or "QmHash")
 * @param gateway - IPFS gateway URL (default: Pinata gateway)
 * @returns Accessible HTTP URL
 */
export function ipfsToHttpUrl(
  ipfsUri: string, 
  gateway: string = 'gateway.pinata.cloud'
): string {
  if (!ipfsUri) return '';
  
  // Remove ipfs:// protocol if present
  const hash = ipfsUri.replace(/^ipfs:\/\//, '');
  
  // Return full gateway URL
  return `https://${gateway}/ipfs/${hash}`;
}

/**
 * Extract CID from IPFS URI
 * @param ipfsUri - IPFS URI (e.g., "ipfs://QmHash" or "QmHash")
 * @returns CID string
 */
export function extractCidFromUri(ipfsUri: string): string {
  if (!ipfsUri) return '';
  return ipfsUri.replace(/^ipfs:\/\//, '');
}

/**
 * Validate IPFS CID format
 * @param cid - CID to validate
 * @returns boolean indicating if CID is valid
 */
export function isValidCid(cid: string): boolean {
  if (!cid) return false;
  
  // Basic CID validation (simplified)
  // Real CIDs start with Qm (CIDv0) or b (CIDv1 base32) or z (CIDv1 base58btc)
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]+)$/.test(cid);
}

/**
 * Convert IPFS URI with fallback to placeholder image
 * @param ipfsUri - IPFS URI
 * @param fallbackUrl - Fallback image URL if IPFS fails
 * @returns Accessible HTTP URL or fallback
 */
export function ipfsToHttpUrlWithFallback(
  ipfsUri: string,
  fallbackUrl: string = '/placeholder-image.png'
): string {
  if (!ipfsUri) return fallbackUrl;
  
  const cid = extractCidFromUri(ipfsUri);
  if (!isValidCid(cid)) return fallbackUrl;
  
  return ipfsToHttpUrl(ipfsUri);
}

/**
 * Create IPFS URI from CID
 * @param cid - Content identifier
 * @returns IPFS URI
 */
export function cidToIpfsUri(cid: string): string {
  if (!cid) return '';
  return `ipfs://${cid}`;
}