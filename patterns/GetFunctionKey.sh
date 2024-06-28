#!/bin/bash

# Read JSON payload from stdin
read jsonpayload

# Extract values from JSON
resourceGroup=$(echo $jsonpayload | jq -r '.resourceGroup')
functionAppName=$(echo $jsonpayload | jq -r '.functionAppName')
functionName=$(echo $jsonpayload | jq -r '.functionName')

# Get function keys
output=$(az functionapp function keys list -g "$resourceGroup" -n "$functionAppName" --function-name "$functionName")

# Extract the default function key
functionKey=$(echo $output | jq -r '.default')

# Output the function key in JSON format
echo "{\"FunctionKey\" : \"$functionKey\"}"