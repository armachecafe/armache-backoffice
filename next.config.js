/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for production builds (S3/CloudFront deployment).
  // In dev/test mode, use standard Next.js server for proper dynamic route support.
  ...(process.env.NODE_ENV === 'production' && !process.env.NEXT_DEV_SERVER
    ? { output: 'export' }
    : {}),
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.armachecafe.com',
    // Backoffice pool (armache-staff = us-east-1_FRAnOWoc1) — NOT the customers/store pool (us-east-1_jw3PdJZAN).
    // Client 'staff-internal' belongs to the backoffice pool. AWS names retain the staff
    // vocabulary intentionally (alias-preserved) to avoid Cognito replacement.
    // TRANSITIONAL fallback (removed in P5): the deploy env may still export
    // NEXT_PUBLIC_STAFF_* until it is updated. Values are identical either way.
    NEXT_PUBLIC_BACKOFFICE_POOL_ID:
      process.env.NEXT_PUBLIC_BACKOFFICE_POOL_ID
      || process.env.NEXT_PUBLIC_STAFF_POOL_ID
      || 'us-east-1_FRAnOWoc1',
    NEXT_PUBLIC_BACKOFFICE_CLIENT_ID:
      process.env.NEXT_PUBLIC_BACKOFFICE_CLIENT_ID
      || process.env.NEXT_PUBLIC_STAFF_CLIENT_ID
      || '7m807gp232a2uf4lps6c9kubom',
  },
};

module.exports = nextConfig;
