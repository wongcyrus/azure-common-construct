import { Construct } from 'constructs'
import { ResourceGroup, ContainerRegistry, ContainerRegistryTask } from "../.gen/providers/azurerm"
import { DataHttp } from "../.gen/providers/http"
import { Resource } from "../.gen/providers/null"


export interface AzureStaticConstainerConfig {
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly gitHubUserName: string
    readonly gitHubRepo: string
    readonly branch?: string
    readonly gitAccessToken: string
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

        const dockerFile = new DataHttp(this, "DataHttp", {
            url: `https://raw.githubusercontent.com/${config.gitHubUserName}/${config.gitHubRepo}/${branch}/Dockerfile`
        })

        const nullResource = new Resource(this, "NullResource", {
            triggers: { dockerfile: dockerFile.body },
            dependsOn: [containerRegistryTask]
        })
        nullResource.addOverride("provisioner.local-exec.command",
            `az acr task run --registry ${this.containerRegistry.name} --name build_bastion_image_task`);

    }
}