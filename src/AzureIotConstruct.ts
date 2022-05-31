import { Construct } from 'constructs'
import {  Iothub, ResourceGroup, IothubSharedAccessPolicyA } from "../.gen/providers/azurerm"


export interface AzureIoTConfig {
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
}

export class AzureIotConstruct extends Construct {
    public readonly iothub: Iothub;  
    public readonly iothubPrimaryConnectionString: string;

    constructor(
        scope: Construct,
        name: string,
        config: AzureIoTConfig
    ) {
        super(scope, name)

        
        this.iothub = new Iothub(this, "Iothub", {
            name: config.prefix + "Iothub",
            resourceGroupName: config.resourceGroup.name,
            location: config.resourceGroup.location,
            sku: { capacity: 1, name: "S1" },
            cloudToDevice: {
                maxDeliveryCount: 30,
                defaultTtl: "PT1H",
                feedback: [{ timeToLive: "PT1H10M", maxDeliveryCount: 15, lockDuration: "PT30S" }]
            },
            tags: { environment: config.environment }
        })       

        const iothubSharedAccessPolicyA = new IothubSharedAccessPolicyA(this, "IothubSharedAccessPolicyA", {
            name: config.prefix + "IothubSharedAccessPolicy",
            resourceGroupName: config.resourceGroup.name,
            iothubName: this.iothub.name,
            registryRead: true,
            registryWrite: true,
            serviceConnect: true,
            deviceConnect: true,
        })

        this.iothubPrimaryConnectionString = iothubSharedAccessPolicyA.primaryConnectionString
    }
}