[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]
    $connectionString,
    [Parameter(Mandatory = $true)]
    [string]
    $localFolder,
    [Parameter(Mandatory = $true)]
    [string]
    $functionFolder
)

$share = az storage share list --connection-string $connectionString | ConvertFrom-Json
$shareName = $share.name
Write-Output $shareName

az storage directory create --name "data/Functions/$functionFolder" --share-name $shareName --connection-string $connectionString
Get-ChildItem $localFolder | 
Foreach-Object {    
    az storage file upload --share-name $shareName --path data/Functions/$functionFolder/$_ --source $_.FullName --connection-string $connectionString
}
