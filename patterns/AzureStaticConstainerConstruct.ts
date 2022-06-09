import { Construct } from 'constructs'
import { ResourceGroup, ContainerRegistry, ContainerRegistryTask } from "cdktf-azure-providers/.gen/providers/azurerm"
import { DataHttp } from "cdktf-azure-providers/.gen/providers/http"
import { Resource } from "cdktf-azure-providers/.gen/providers/null"


export interface AzureStaticConstainerConfig {
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly gitHubUserName: string
    readonly gitHubRepo: string
    readonly branch?: string
    readonly gitAccessToken: string
    readonly dockerBuildArguments?: { [key: string]: string }
}

export class AzureStaticConstainerConstruct extends Construct {
    public readonly containerRegistry: ContainerRegistry;

    constructor(
        scope: Construct,
        name: string,
        config: AzureStaticConstainerConfig
    ) {
        super(scope, name)

        this.containerRegistry = new ContainerRegistry(this, "ContainerConnectedRegistry", {
            name: config.prefix + "ContainerRegistry",
            sku: "Standard",
            resourceGroupName: config.resourceGroup.name,
            location: config.resourceGroup.location,
            adminEnabled: true
        })

        const branch = config.branch ?? "main"
        const containerRegistryTask = new ContainerRegistryTask(this, "ContainerRegistryTask", {
            name: "build_bastion_image_task",
            containerRegistryId: this.containerRegistry.id,
            platform: { os: "Linux" },
            dockerStep: {
                dockerfilePath: "Dockerfile",
                contextPath: `https://github.com/${config.gitHubUserName}/${config.gitHubRepo}#${branch}`,
                contextAccessToken: config.gitAccessToken,
                imageNames: [config.gitHubRepo + ":latest"]
            }
        })

        if(config.dockerBuildArguments)
            containerRegistryTask.dockerStep.arguments = config.dockerBuildArguments!
        const repoHash = new DataHttp(this, "DataHttp", {
            url: `https://api.github.com/repos/${config.gitHubUserName}/${config.gitHubRepo}/git/refs/heads/${branch}`
        })

        const nullResource = new Resource(this, "NullResource", {
            triggers: { repoHash: repoHash.responseBody },
            dependsOn: [containerRegistryTask]
        })
        nullResource.addOverride("provisioner.local-exec.command",
            `az acr task run --registry ${this.containerRegistry.name} --name build_bastion_image_task`);

    }
}