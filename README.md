# azure-common-construct

This package is a Typescript package for some common Azure L3 CDK-TF patterns.
1. AzureFunctionLinuxConstruct - C# Azure function in Linux.
2. AzureIotConstruct - Azure IoTHub and return primary connection string.
3. AzureIotEventHubConstruct - Child class of AzureIotConstruct, added Event hub sink and return EventHub primary connection string.
4. AzureIotDeviceConstruct - Create Azure IoT Device and return device key.
5. AzureStaticConstainerConstruct - Build static Docker image and put it in ACR. 


This package includes:
1. "azurerm@~> 3.7.0"
2. "azuread@~>2.22.0"
3. "random@~>3.2.0"
4. "null@~>3.1.1"
5. "external@~>2.2.2"
6. "archive@~>2.2.0"
7. "http@~>2.1.0"

Some of the functions are using powershell to invoke Azure cli,
You need to install Azure cli 
1. Login AZ cli, but you should always complete this for Terraform.
2. set ```az config set extension.use_dynamic_install=yes_without_prompt```.


