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
  transpilePackages: ['@armache/shared-types'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.armachecafe.com',
    // Staff pool (armache-staff = us-east-1_FRAnOWoc1) — NOT the customers/store pool (us-east-1_jw3PdJZAN).
    // Client 'staff-internal' belongs to the staff pool. The old '2g55...' was 'backoffice-operator'
    // on the STORE pool (cross-wiring that let staff creds work in the store but not the backoffice).
    NEXT_PUBLIC_STAFF_POOL_ID: process.env.NEXT_PUBLIC_STAFF_POOL_ID || 'us-east-1_FRAnOWoc1',
    NEXT_PUBLIC_STAFF_CLIENT_ID: process.env.NEXT_PUBLIC_STAFF_CLIENT_ID || '7m807gp232a2uf4lps6c9kubom',
  },
};

module.exports = nextConfig;
