$SettingsObject = Get-Content -Path key.json | ConvertFrom-Json
dotnet nuget push .\dist\dotnet\AzureCommonConstruct.Jsii.0.0.3.nupkg --api-key $SettingsObject.nugetApiKey --source https://api.nuget.org/v3/index.json
python3 -m twine upload --repository testpypi dist/*