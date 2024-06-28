#!/bin/bash

# Mandatory parameters
connectionString=$1
localFolder=$2
functionFolder=$3

# Validate parameters
if [ -z "$connectionString" ] || [ -z "$localFolder" ] || [ -z "$functionFolder" ]; then
  echo "Usage: $0 <connectionString> <localFolder> <functionFolder>"
  exit 1
fi

# Get share name
share=$(az storage share list --connection-string "$connectionString" | jq -r '.[0].name')
echo $share

# Create directory in share
az storage directory create --name "data/Functions/$functionFolder" --share-name "$share" --connection-string "$connectionString"

# Upload files
find "$localFolder" -type f | while read file; do
  fileName=$(basename "$file")
  az storage file upload --share-name "$share" --path "data/Functions/$functionFolder/$fileName" --source "$file" --connection-string "$connectionString"
done