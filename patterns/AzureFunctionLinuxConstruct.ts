import { StringResource } from 'cdktf-azure-providers/.gen/providers/random/string-resource'
import { Construct } from 'constructs'
import { StorageAccount } from "cdktf-azure-providers/.gen/providers/azurerm/storage-account"
import { ApplicationInsights } from "cdktf-azure-providers/.gen/providers/azurerm/application-insights"
import { ServicePlan } from "cdktf-azure-providers/.gen/providers/azurerm/service-plan"
import { ResourceGroup } from "cdktf-azure-providers/.gen/providers/azurerm/resource-group";
import { LinuxFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/linux-function-app";


import { PublisherConstruct, PublishMode } from './PublisherConstruct';


export interface AzureFunctionLinuxConstructConfig {
    readonly functionAppName?: string
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly appSettings: { [key: string]: string }
    readonly vsProjectPath: string
    readonly skuName?: string
    readonly publishMode: PublishMode,
    readonly functionNames?: string[]
}

export class AzureFunctionLinuxConstruct extends Construct {
    public readonly functionApp: LinuxFunctionApp;
    public readonly storageAccount: StorageAccount;
    public readonly functionKeys?: { [key: string]: string };
    public readonly functionUrls?: { [key: string]: string };

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
            name: config.functionAppName ?? config.prefix + "FunctionApp",
            location: config.resourceGroup.location,
            resourceGroupName: config.resourceGroup.name,
            servicePlanId: appServicePlan.id,
            storageAccountName: this.storageAccount.name,
            storageAccountAccessKey: this.storageAccount.primaryAccessKey,
            functionsExtensionVersion: "~4",
            identity: { type: "SystemAssigned" },
            lifecycle: {
                ignoreChanges: ["app_settings[\"WEBSITE_RUN_FROM_PACKAGE\"]"]
            },
            appSettings: appSettings,
            siteConfig: {
            }
        })

        const publisherConstructConstruct = new PublisherConstruct(this, "PublisherConstructConstruct", {
            functionApp: this.functionApp,
            publishMode: config.publishMode,
            vsProjectPath: config.vsProjectPath,
            resourceGroup: config.resourceGroup,
            functionNames: config.functionNames
        })
        this.functionKeys = publisherConstructConstruct.functionKeys
        this.functionUrls = publisherConstructConstruct.functionUrls
    }
}