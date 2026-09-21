#!/usr/bin/env bash
set -euo pipefail

BUCKET="${BACKOFFICE_BUCKET_NAME:-}"
DISTRIBUTION_ID="${BACKOFFICE_DISTRIBUTION_ID:-}"
DIST_DIR="./out"

if [ -z "$BUCKET" ] || [ -z "$DISTRIBUTION_ID" ]; then
  echo "❌ BACKOFFICE_BUCKET_NAME and BACKOFFICE_DISTRIBUTION_ID must be set"
  exit 1
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Build directory not found: $DIST_DIR"
  exit 1
fi

aws s3 sync "$DIST_DIR/_next/static" "s3://$BUCKET/_next/static" \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync "$DIST_DIR" "s3://$BUCKET/" \
  --delete \
  --exclude "_next/static/*" \
  --cache-control "public, max-age=0, must-revalidate"

aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo "✅ Backoffice deployed"
