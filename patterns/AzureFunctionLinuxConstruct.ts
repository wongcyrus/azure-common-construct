import { StringResource } from '../.gen/providers/random'
import { Construct } from 'constructs'
import path = require('path')
import { ResourceGroup, ApplicationInsights, ServicePlan, LinuxFunctionApp, StorageAccount } from "../.gen/providers/azurerm"
import { Resource } from "../.gen/providers/null"
import { DataArchiveFile } from "../.gen/providers/archive"

export enum PublishMode {
    Always = 1,
    AfterCodeChange,
    Manual
}
export interface AzureFunctionLinuxConstructConfig {
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly appSettings: { [key: string]: string }
    readonly vsProjectPath: string
    readonly skuName?: string
    readonly publishMode: PublishMode
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



        if (config.publishMode !== PublishMode.Manual) {
            const vsProjectPath = config.vsProjectPath;
            const build_hash = config.publishMode == PublishMode.Always ? "${timestamp()}" : `sha1(join("", [for f in fileset("${vsProjectPath}", "**/*.cs"): filesha1(f)]))`;

            const buildFunctionAppResource = new Resource(this, "BuildFunctionAppResource",
                {
                    triggers: { build_hash: build_hash },
                    dependsOn: [this.functionApp]
                })

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
                    triggers: { build_hash: build_hash },
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
}