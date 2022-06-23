$jsonpayload = [Console]::In.ReadLine()
$json = ConvertFrom-Json $jsonpayload
$resourceGroup = $json.resourceGroup
$iotHubName = $json.iotHubName
$deviceId = $json.deviceId

$device = az iot hub device-identity show --device-id $deviceId --hub-name $iotHubName --resource-group $resourceGroup 2>$null | ConvertFrom-Json
if ($device) { 
    $device = az iot hub device-identity show --device-id $deviceId --hub-name $iotHubName --resource-group $resourceGroup 2>$null | ConvertFrom-Json
}
else {    
    $device = az iot hub device-identity create --device-id $deviceId --hub-name $iotHubName --resource-group $resourceGroup --auth-method "shared_private_key"  | ConvertFrom-Json
}
$deviceKey = $device.Authentication.SymmetricKey.PrimaryKey
Write-Output "{""deviceKey"" : ""$deviceKey""}"

