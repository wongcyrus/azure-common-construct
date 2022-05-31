import { StringResource } from '../.gen/providers/random'
import { Construct } from 'constructs'
import path = require('path')
import { ResourceGroup, ApplicationInsights, ServicePlan, LinuxFunctionApp, StorageAccount } from "../.gen/providers/azurerm"
import { Resource } from "../.gen/providers/null"
import { DataArchiveFile } from "../.gen/providers/archive"

export interface AzureFunctionLinuxConstructConfig {
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly appSettings: { [key: string]: string }
    readonly vsProjectPath: string    
    readonly skuName?: string
}

export class AzureFunctionLinuxConstruct extends Construct {
    public readonly functionApp: LinuxFunctionApp;
    public readonly storageAccount: StorageAccount;

    constructor(
        scope: Construct,
        name: string,
        config: AzureFunctionLinuxConstructConfig
    ) {
        super(scope, name)

        const applicationInsights = new ApplicationInsights(this, "ApplicationInsights", {
            name: config.prefix + "ApplicationInsights",
            location: config.resourceGroup.location,
            resourceGroupName: config.resourceGroup.name,
            applicationType: "other"
        })

        const appServicePlan = new ServicePlan(this, "AppServicePlan", {
            name: config.prefix + "AppServicePlan",
            location: config.resourceGroup.location,
            resourceGroupName: config.resourceGroup.name,
            skuName: config.skuName ?? "Y1",
            osType: "Linux",
        })

        const suffix = new StringResource(this, "Random", {
            length: 5,
            special: false,
            lower: true,
            upper: false,
        })
        this.storageAccount = new StorageAccount(this, "StorageAccount", {
            name: suffix.result,
            location: config.resourceGroup.location,
            resourceGroupName: config.resourceGroup.name,
            accountTier: "Standard",
            accountReplicationType: "LRS"
        })

        const appSettings = { ...config.appSettings };
        appSettings['FUNCTIONS_WORKER_RUNTIME'] = "dotnet"
        appSettings['AzureWebJobsStorage'] = this.storageAccount.primaryConnectionString
        appSettings['APPINSIGHTS_INSTRUMENTATIONKEY'] = applicationInsights.instrumentationKey
        appSettings['WEBSITE_RUN_FROM_PACKAGE'] = "1"
        appSettings['FUNCTIONS_WORKER_RUNTIME'] = "dotnet"
        appSettings['Environment'] = config.environment

        this.functionApp = new LinuxFunctionApp(this, "FunctionApp", {
            name: config.prefix + "FunctionApp",
            location: config.resourceGroup.location,
            resourceGroupName: config.resourceGroup.name,
            servicePlanId: appServicePlan.id,
            storageAccountName: this.storageAccount.name,
            storageAccountAccessKey: this.storageAccount.primaryAccessKey,

            identity: { type: "SystemAssigned" },
            lifecycle: {
                ignoreChanges: ["app_settings[\"WEBSITE_RUN_FROM_PACKAGE\"]"]
            },
            appSettings: appSettings,
            siteConfig: {
            }
        })

        const buildFunctionAppResource = new Resource(this, "BuildFunctionAppResource",
            {
                triggers: { build_number: "${timestamp()}" },
                dependsOn: [this.functionApp]
            })

        const vsProjectPath = config.vsProjectPath;
        buildFunctionAppResource.addOverride("provisioner", [
            {
                "local-exec": {
                    working_dir: vsProjectPath,
                    command: "dotnet publish -p:PublishProfile=FolderProfile"
                },
            },
        ]);
        const publishPath = path.join(vsProjectPath, "/bin/Release/net6.0/publish");
        const outputZip = path.join(publishPath, "../deployment.zip")
        const dataArchiveFile = new DataArchiveFile(this, "DataArchiveFile", {
            type: "zip",
            sourceDir: publishPath,
            outputPath: outputZip,
            dependsOn: [buildFunctionAppResource]
        })

        const publishFunctionAppResource = new Resource(this, "PublishFunctionAppResource",
            {
                triggers: { build_number: "${timestamp()}" },
                dependsOn: [dataArchiveFile]
            })

        publishFunctionAppResource.addOverride("provisioner", [
            {
                "local-exec": {
                    command: `az functionapp deployment source config-zip --resource-group ${config.resourceGroup.name} --name ${this.functionApp.name} --src ${dataArchiveFile.outputPath}`
                },
            },
        ]);



    }
}