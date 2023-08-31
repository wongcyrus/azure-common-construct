import { Construct } from 'constructs'
import { ResourceGroup } from "cdktf-azure-providers/.gen/providers/azurerm/resource-group";
import { ApiManagement } from "cdktf-azure-providers/.gen/providers/azurerm/api-management";
import { ApiManagementNamedValue } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-named-value";
import { ApiManagementApi } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-api";
import { ApiManagementApiOperation } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-api-operation";
import { LinuxFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/linux-function-app";
import { ApiManagementApiPolicy } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-api-policy";
import { ApiManagementUser } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-user";
import { ApiManagementSubscription } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-subscription";
import { WindowsFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/windows-function-app";
import { ApiManagementBackend } from "cdktf-azure-providers/.gen/providers/azurerm/api-management-backend";
import { DataAzurermFunctionAppHostKeys } from "cdktf-azure-providers/.gen/providers/azurerm/data-azurerm-function-app-host-keys";


export type ApiUser = {
    id: string
    firstName: string
    lastName: string
    email: string
};

export type ApiUserKey = ApiUser & {
    apiKey: string
}

export interface AzureApiManagementConstructConfig {
    readonly functionApp: LinuxFunctionApp | WindowsFunctionApp
    readonly apiName: string
    readonly publisherName: string
    readonly publisherEmail: string
    readonly corsDomain?: string
    readonly keyRateLimit?: number
    readonly ipRateLimit?: number
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly skuName: string
    readonly wpiUsers: ApiUser[]
    readonly functionNames?: string[]
}

export class AzureApiManagementConstruct extends Construct {
    public readonly apiUsers: ApiUserKey[]
    public readonly apiManagement: ApiManagement
    constructor(
        scope: Construct,
        name: string,
        config: AzureApiManagementConstructConfig
    ) {
        super(scope, name)

        const dataAzurermFunctionAppHostKeys = new DataAzurermFunctionAppHostKeys(this, "DataAzurermFunctionAppHostKeys", {
            name: config.functionApp.name,
            resourceGroupName: config.resourceGroup.name,
        })

        const apiManagement = new ApiManagement(this, "ApiManagement", {
            name: `api-${config.apiName}`,
            location: config.resourceGroup.location,
            publisherName: config.publisherName,
            publisherEmail: config.publisherEmail,
            resourceGroupName: config.resourceGroup.name,
            skuName: config.skuName,

        })
        this.apiManagement = apiManagement;

        const apiManagementNamedValue = new ApiManagementNamedValue(this, "ApiManagementNamedValue", {
            name: "func-functionkey",
            resourceGroupName: config.resourceGroup.name,
            apiManagementName: apiManagement.name,
            displayName: "func-functionkey",
            value: dataAzurermFunctionAppHostKeys.primaryKey,
            secret: true
        })

        const apiManagementApi = new ApiManagementApi(this, "ApiManagementApi", {
            name: config.apiName,
            resourceGroupName: config.resourceGroup.name,
            apiManagementName: apiManagement.name,
            revision: "2",
            displayName: config.apiName,
            protocols: ["https"]
        })

        if (config.functionNames)
            for (let f of config.functionNames) {
                new ApiManagementApiOperation(this, "ApiManagementApiOperation" + f + "Get", {
                    operationId: f + "-get",
                    apiManagementName: apiManagementApi.apiManagementName,
                    apiName: apiManagementApi.name,
                    resourceGroupName: config.resourceGroup.name,
                    displayName: f + "-get",
                    method: "GET",
                    urlTemplate: "/" + f,
                    description: "This can only be done by the logged in user.",
                    response: [{
                        statusCode: 200
                    }]
                })

                new ApiManagementApiOperation(this, "ApiManagementApiOperation" + f + "Post", {
                    operationId: f + "-post",
                    apiManagementName: apiManagementApi.apiManagementName,
                    apiName: apiManagementApi.name,
                    resourceGroupName: config.resourceGroup.name,
                    displayName: f + "-post",
                    method: "POST",
                    urlTemplate: "/" + f,
                    description: "This can only be done by the logged in user.",
                    response: [{
                        statusCode: 200
                    }]
                })
            }


        const apiManagementBackend = new ApiManagementBackend(this, "ApiManagementBackend", {
            name: `${config.apiName}Backend`,
            resourceGroupName: config.resourceGroup.name,
            apiManagementName: apiManagement.name,
            protocol: "http",
            url: `https://${config.functionApp.defaultHostname}/api/`,
            dependsOn: [apiManagementNamedValue],
            credentials: {
                header: {
                    "x-functions-key": "{{func-functionkey}}"
                }
            }
        })

        let rateLimitRules = "";
        if (config.keyRateLimit)
            rateLimitRules += `
          <set-header name="request-email" exists-action="override">
            <value>@(context.User.Email)</value>
          </set-header>
          <set-header name="request-id" exists-action="override">
            <value>@(context.User.Id)</value>
          </set-header>
          <rate-limit calls="${config.keyRateLimit}" renewal-period="60" />          
          `
        if (config.ipRateLimit)
            rateLimitRules += `<rate-limit-by-key calls="${config.ipRateLimit}" renewal-period="60" counter-key="@(context.Request.IpAddress)" />`

        const cors = config.corsDomain ? `
    <cors>
        <allowed-origins>
            <origin>${config.corsDomain}</origin>
        </allowed-origins>
        <allowed-methods preflight-result-max-age="300"> 
            <method>*</method> 
        </allowed-methods> 
        <allowed-headers> 
            <header>*</header> 
        </allowed-headers> 
        <expose-headers> 
            <header>*</header> 
        </expose-headers> 
    </cors>`: "";
        new ApiManagementApiPolicy(this, "ApiManagementApiPolicy", {
            apiName: apiManagementApi.name,
            apiManagementName: apiManagement.name,
            resourceGroupName: config.resourceGroup.name,
            xmlContent: `
      <policies>
        <inbound>
            ${cors} 
            ${rateLimitRules}
          <base />
          <set-backend-service backend-id="${apiManagementBackend.name}" />
        </inbound>
      </policies>
      `
        })

        this.apiUsers = [];
        let i = 0;
        for (let apiUser of config.wpiUsers) {
            const apiManagementUser = new ApiManagementUser(this, "ApiManagementUser" + i, {
                userId: apiUser.id,
                apiManagementName: apiManagement.name,
                resourceGroupName: config.resourceGroup.name,
                email: apiUser.email,
                firstName: apiUser.firstName,
                lastName: apiUser.lastName,
                state: "active"
            })

            const apiManagementSubscription = new ApiManagementSubscription(this, "ApiManagementSubscription" + i, {
                apiManagementName: apiManagement.name,
                resourceGroupName: config.resourceGroup.name,
                userId: apiManagementUser.id,
                displayName: apiUser.id + ":" + apiUser.firstName + " " + apiUser.lastName,
                apiId: apiManagementApi.id,
                state: "active"
            })
            let apiUserKey: ApiUserKey = { ...apiUser, apiKey: apiManagementSubscription.primaryKey }
            this.apiUsers.push(apiUserKey)
            i++;
        }
    }
}