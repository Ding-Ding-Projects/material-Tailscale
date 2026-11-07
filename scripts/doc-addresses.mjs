// Rewrites private IPv4 examples from upstream text into the RFC 5737
// documentation ranges, so generated files never carry private addresses.
export function docAddresses(text) {
  const fix = (base) => (_, last, mask) => `${base}.${last}${mask ? '/' + Math.max(24, Number(mask.slice(1))) : ''}`;
  return text
    .replace(/\b10\.\d{1,3}\.\d{1,3}\.(\d{1,3})(\/\d{1,2})?\b/g, fix('198.51.100'))
    .replace(/\b192\.168\.\d{1,3}\.(\d{1,3})(\/\d{1,2})?\b/g, fix('192.0.2'))
    .replace(/\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.(\d{1,3})(\/\d{1,2})?\b/g, fix('203.0.113'));
}
