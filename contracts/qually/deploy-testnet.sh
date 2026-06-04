#!/bin/bash
# Qually Testnet Deployment Script
# Run this after obtaining testnet SUI from the faucet

set -e

echo "=== Qually Testnet Deployment ==="
echo ""

# Check sui is installed
if ! command -v sui &> /dev/null; then
    echo "Error: sui CLI not found. Install from https://sui.io"
    exit 1
fi

# Check active network
ACTIVE_ENV=$(sui client active-env)
if [ "$ACTIVE_ENV" != "testnet" ]; then
    echo "Switching to testnet..."
    sui client switch --env testnet
fi

# Check balance
BALANCE=$(sui client balance --json 2>/dev/null | jq -r '.totalBalance // "0"')
if [ "$BALANCE" = "0" ] || [ -z "$BALANCE" ]; then
    echo "Error: No SUI balance on testnet."
    echo "Get testnet SUI from: https://faucet.sui.io"
    exit 1
fi

echo "Active network: testnet"
echo "Balance: $BALANCE MIST"
echo ""

# Build contracts
echo "Building contracts..."
sui move build --path .

# Publish contracts
echo ""
echo "Publishing to testnet..."
echo "This will use ~1 SUI for gas and storage deposit."
echo ""

PUBLISH_OUTPUT=$(sui client publish --gas-budget 100000000 . 2>&1)
echo "$PUBLISH_OUTPUT"

# Extract package ID
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -oP 'Published Objects.*?PackageID:\s+\K[0-9a-fx]+' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    # Try alternative parsing
    PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -oP '0x[0-9a-f]{64}' | head -1)
fi

if [ -z "$PACKAGE_ID" ]; then
    echo ""
    echo "Warning: Could not auto-extract Package ID."
    echo "Please check the output above and copy the Package ID manually."
    echo "Then update FrontendIntegration.md with the address."
else
    echo ""
    echo "=== DEPLOYMENT SUCCESSFUL ==="
    echo "Package ID: $PACKAGE_ID"
    echo ""
    echo "Next steps:"
    echo "1. Copy the Package ID above"
    echo "2. Update FrontendIntegration.md line 11 with the Package ID"
    echo "3. Verify on Sui Explorer: https://suiexplorer.com/network/testnet"
    echo ""
    echo "Treasury object was auto-created during deployment."
    echo "Check the deploy output above for the Treasury object address."
fi
