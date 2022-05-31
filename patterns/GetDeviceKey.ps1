$jsonpayload = [Console]::In.ReadLine()
$json = ConvertFrom-Json $jsonpayload
$resourceGroup = $json.resourceGroup
$iotHubName = $json.iotHubName
$deviceId = $json.deviceId

$device = Get-AzIotHubDevice -ResourceGroupName $resourceGroup -IotHubName $iotHubName -DeviceId $deviceId

if (-Not $device){
    $result = Remove-AzIotHubDevice -ResourceGroupName $resourceGroup -IotHubName $iotHubName -DeviceId $deviceId -PassThru
    $device = Add-AzIotHubDevice -ResourceGroupName $resourceGroup -IotHubName $iotHubName -DeviceId $deviceId -AuthMethod "shared_private_key"
}
$deviceKey = $device.Authentication.SymmetricKey.PrimaryKey
Write-Output "{""deviceKey"" : ""$deviceKey""}"
