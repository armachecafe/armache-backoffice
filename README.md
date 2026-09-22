# Armache Backoffice

Next.js 14 static-export backoffice for Armache Cafe.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Deploy

```bash
export BACKOFFICE_BUCKET_NAME=<bucket>
export BACKOFFICE_DISTRIBUTION_ID=<distribution-id>
pnpm build
bash scripts/deploy.sh
```

## Contract dependency

Types are generated from `@armachecafe/openapi-client` (published from the backend repo).
