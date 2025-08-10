#!/usr/bin/env bash
set -euo pipefail

# Mandatory parameters
connectionString=${1:-}
localFolder=${2:-}
functionFolder=${3:-}

# Validate parameters
if [ -z "$connectionString" ] || [ -z "$localFolder" ] || [ -z "$functionFolder" ]; then
  echo "Usage: $0 <connectionString> <localFolder> <functionFolder>" >&2
  exit 1
fi

if [ ! -d "$localFolder" ]; then
  echo "Local folder not found: $localFolder" >&2
  exit 1
fi

# Resolve storage share name (first share in the account)
share=$(az storage share list --connection-string "$connectionString" -o tsv --query "[0].name")
if [ -z "$share" ]; then
  echo "No Azure File shares found for the provided connection string" >&2
  exit 1
fi
echo "Uploading to share: $share"

# Ensure target directory exists
az storage directory create \
  --name "data/Functions/$functionFolder" \
  --share-name "$share" \
  --connection-string "$connectionString" \
  -o none || true

# Try fast path with azcopy (parallel, recursive). Fallback to az CLI batch.
if command -v azcopy >/dev/null 2>&1; then
  # Extract account name from connection string (AccountName=...;)
  accountName=$(echo "$connectionString" | tr ';' '\n' | awk -F= '$1=="AccountName"{print $2}')
  if [ -z "$accountName" ]; then
    echo "Failed to parse AccountName from connection string" >&2
    exit 1
  fi

  # Generate a short-lived SAS for the share
  expiry=$(date -u -d "+2 hours" "+%Y-%m-%dT%H:%MZ" 2>/dev/null || date -u -v+2H "+%Y-%m-%dT%H:%MZ")
  sas=$(az storage share generate-sas \
    --name "$share" \
    --permissions rlwdacup \
    --expiry "$expiry" \
    --connection-string "$connectionString" \
    -o tsv)
  if [ -z "$sas" ]; then
    echo "Failed to generate SAS token for share $share" >&2
    exit 1
  fi

  destUrl="https://${accountName}.file.core.windows.net/${share}/data/Functions/${functionFolder}?${sas}"
  echo "Using azcopy to upload recursively from $localFolder to $destUrl"

  # Optional: allow tuning concurrency via env, default is azcopy's internal heuristic
  azcopy copy "$localFolder" "$destUrl" \
    --recursive \
    --overwrite=IfSourceNewer \
    --from-to=LocalFileFS 1>&2
else
  echo "azcopy not found, falling back to 'az storage file upload-batch'" >&2
  az storage file upload-batch \
    --source "$localFolder" \
    --destination "$share" \
    --destination-path "data/Functions/$functionFolder" \
    --connection-string "$connectionString" \
    -o table 1>&2
fi

echo "Upload completed."