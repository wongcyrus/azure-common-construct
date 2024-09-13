# azure-common-construct

This package is a Typescript package for some common Azure L3 CDK-TF patterns.
1. AzureFunctionLinuxConstruct and AzureFunctionWindowsConstruct – C# Azure function in Linux with consumption plan and handle publishing application.
2. AzureIotConstruct - Azure IoTHub and return primary connection string.
3. AzureIotEventHubConstruct - Child class of AzureIotConstruct, added Event hub sink and return EventHub primary connection string.
4. AzureIotDeviceConstruct – Using terraform external data provider and Azure CLI to create Azure IoT Device and return device key.
5. AzureStaticConstainerConstruct - Build static Docker image and put it in ACR. Image will rebuild when docker GitHub branch is updated.
6. PublisherConstruct - Used by AzureFunctionLinuxConstruct and AzureFunctionWindowsConstruct. It runs "dotnet publish -p:PublishProfile=FolderProfile" and "az functionapp deployment source config-zip" based on PublishMode. Extract Function keys and urls when functionNames presents.
You have to create /Properties/PublishProfiles/FolderProfile.pubxml with the same PublishDir.
```
<Project>
    <PropertyGroup>
        <PublishProtocol>FileSystem</PublishProtocol>   
        <PublishDir>$(MSBuildProjectDirectory)/bin/Release/publish/azfunction</PublishDir>
        <TargetFramework>net8.0</TargetFramework>
        <RuntimeIdentifier>linux-x64</RuntimeIdentifier>
        <SelfContained>true</SelfContained>
        <PublishSingleFile>false</PublishSingleFile>
        <PublishReadyToRun>true</PublishReadyToRun>
    </PropertyGroup>
</Project>
```
7. AzureFunctionFileSharePublisherConstruct - Upload folder to Azure Function fileshare.
8. AzureApiManagementConstruct - Azure Function wrapper with API Key and Rate Limit settings.

Some of the functions are using powershell to invoke Azure cli,
You need to install Azure cli 
1. Login AZ cli, but you should always complete this for Terraform.
2. set ```az config set extension.use_dynamic_install=yes_without_prompt```.


Install CDKTF and login npm
```
npm install --global cdktf-cli@latest
npm i
npm adduser
```

To publish new version,
```
npm run build
npm publish
```


