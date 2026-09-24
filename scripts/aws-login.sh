#!/usr/bin/env bash
#
# aws-login.sh — AWS SSO login for the current terminal.
#
# USAGE:
#   source scripts/aws-login.sh
#
# Ensures a valid SSO login for the AWS CLI (used by `pnpm sync:contract`
# and `scripts/deploy.sh`). AWS CLI v2 resolves the SSO cache on its own,
# so this script just logs in when the cached token is missing or expired —
# no Pulumi, no credential materialization needed in this repo.
#
# SSO tokens last ~1 hour. If AWS calls fail with ExpiredToken/InvalidToken,
# simply re-run this script.
#
# Profile override:
#   AWS_SSO_PROFILE=other-profile source scripts/aws-login.sh

PROFILE="${AWS_SSO_PROFILE:-481084557193_AdministratorAccess}"

echo "==> Profile: $PROFILE"

# Static env vars left over from another session take precedence over the SSO
# profile in the credential chain — clear them so the real profile is used.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_CREDENTIAL_EXPIRATION 2>/dev/null

export AWS_PROFILE="$PROFILE"
export AWS_REGION="${AWS_REGION:-us-east-1}"

# SSO login only if the cached token is missing or expired.
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "==> SSO token expired or missing. Starting login..."
  if ! aws sso login; then
    echo "==> ✗ SSO login failed. Check profile '$PROFILE' in ~/.aws/config."
    unset AWS_PROFILE 2>/dev/null
    return 1 2>/dev/null || exit 1
  fi
fi

echo "==> ✓ AWS credentials active:"
aws sts get-caller-identity --output table 2>/dev/null
echo "==> If AWS calls fail with ExpiredToken later, re-run: source scripts/aws-login.sh"
