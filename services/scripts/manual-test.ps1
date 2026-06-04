# Manual E2E Test using Sui CLI
# Run each command step by step

$PACKAGE_ID = "0x8411168d485ebbfadfcae8bed614ef3d4e9d2ac5efc238b908e6851634f12498"
$TREASURY_ID = "0xa0a82717e3823a8eca7af313455aad3caa0832946626bc40568bd3fe8148ffb3"
$WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space"

Write-Host "=== Qually Manual E2E Test ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Upload brief to Walrus
Write-Host "Step 1: Upload brief to Walrus" -ForegroundColor Yellow
$brief = '{"title":"Test Bounty","description":"E2E test bounty","acceptance_criteria":["Submit code"],"skill_tags":["test"]}'
$briefBytes = [System.Text.Encoding]::UTF8.GetBytes($brief)

try {
    $response = Invoke-WebRequest -Uri "$WALRUS_PUBLISHER/v1/blobs?epochs=1&deletable=true" -Method PUT -Body $briefBytes -ContentType "application/octet-stream" -TimeoutSec 60
    $result = $response.Content | ConvertFrom-Json
    $briefBlobId = $result.newlyCreated.blobObject.blobId
    Write-Host "  Brief uploaded: $briefBlobId" -ForegroundColor Green
} catch {
    Write-Host "  Error uploading: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create bounty
Write-Host ""
Write-Host "Step 2: Create bounty on-chain" -ForegroundColor Yellow

# Get current timestamp + 24h and +48h
$deadline1 = [DateTimeOffset]::UtcNow.AddHours(24).ToUnixTimeMilliseconds()
$deadline2 = [DateTimeOffset]::UtcNow.AddHours(48).ToUnixTimeMilliseconds()

# Create bounty using sui client
$createCmd = @"
sui client call --package $PACKAGE_ID --module bounty --function create_bounty --args 0 1000000000 '$briefBlobId' 'e2e-test-hash' $deadline1 $deadline2 50 3 true '[]' false false '["test"]' --gas-budget 50000000
"@

Write-Host "  Running: sui client call --package $PACKAGE_ID --module bounty --function create_bounty ..."
Write-Host ""
Write-Host "  Copy and run this command manually:" -ForegroundColor Cyan
Write-Host ""
Write-Host "sui client call --package $PACKAGE_ID --module bounty --function create_bounty --args 0 1000000000 '$briefBlobId' 'e2e-test-hash' $deadline1 $deadline2 50 3 true '[]' false false '["test"]' --gas-budget 50000000" -ForegroundColor White
Write-Host ""

Write-Host "=== Instructions ===" -ForegroundColor Cyan
Write-Host "1. Copy the command above"
Write-Host "2. Run it in a new terminal"
Write-Host "3. Note the Object ID of the created bounty"
Write-Host "4. Continue with next steps"
Write-Host ""
Write-Host "Brief Blob ID: $briefBlobId" -ForegroundColor Green
