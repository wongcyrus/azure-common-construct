import { Construct } from 'constructs'
import { Eventhub, EventhubNamespace, EventhubAuthorizationRule, IothubEndpointEventhub, IothubRouteA, IothubEnrichmentA } from "cdktf-azure-providers/.gen/providers/azurerm"
import { StringResource } from 'cdktf-azure-providers/.gen/providers/random'
import { AzureIoTConfig, AzureIotConstruct } from './AzureIotConstruct'

export interface AzureEventHubIoTConfig extends AzureIoTConfig {
}

export class AzureIotEventHubConstruct extends AzureIotConstruct {
    public readonly eventhub: Eventhub;
    public readonly eventhubPrimaryConnectionString: string;

    constructor(
        scope: Construct,
        name: string,
        config: AzureEventHubIoTConfig
    ) {
        super(scope, name, config)

        const suffix = new StringResource(this, "Random", {
            length: 5,
            special: false
        })
        const eventhubNamespace = new EventhubNamespace(this, "EventhubNamespace", {
            name: "EventhubNamespace" + suffix.result,
            location: config.resourceGroup.location,
            resourceGroupName: config.resourceGroup.name,
            sku: "Standard"
        })

        this.eventhub = new Eventhub(this, "Eventhub", {
            name: config.prefix + "Eventhub",
            resourceGroupName: config.resourceGroup.name,
            messageRetention: 1,
            namespaceName: eventhubNamespace.name,
            partitionCount: 1
        })

        const azureFunctionEventhubAuthorizationRule = new EventhubAuthorizationRule(this, "AzureFunctionEventhubAuthorizationRule", {
            name: "AzureFunctionEventhubAuthorizationRule",
            namespaceName: eventhubNamespace.name,
            eventhubName: this.eventhub.name,
            resourceGroupName: config.resourceGroup.name,
            listen: true,
            send: true,
            manage: true
        })

        this.eventhubPrimaryConnectionString = azureFunctionEventhubAuthorizationRule.primaryConnectionString
        

        const iothubEndpointEventhub = new IothubEndpointEventhub(this, "IothubEndpointEventhub", {
            resourceGroupName: config.resourceGroup.name,
            iothubId: this.iothub.id,
            name: config.prefix + "IothubEndpointEventhub",
            connectionString: azureFunctionEventhubAuthorizationRule.primaryConnectionString
        })

        new IothubRouteA(this, "IothubRouteDeviceMessages", {
            name: "eventhubdevicemessages",
            source: "DeviceMessages",
            condition: "true",
            endpointNames: [iothubEndpointEventhub.name],
            enabled: true,
            iothubName: this.iothub.name,
            resourceGroupName: config.resourceGroup.name,
        })

        new IothubRouteA(this, "IothubRouteTwinChangeEvents", {
            name: "eventhubtwinchangeevents",
            source: "TwinChangeEvents",
            condition: "true",
            endpointNames: [iothubEndpointEventhub.name],
            enabled: true,
            iothubName: this.iothub.name,
            resourceGroupName: config.resourceGroup.name,
        })

        new IothubRouteA(this, "IothubRouteDeviceConnectionStateEvents", {
            name: "eventhubdeviceconnectionstateevents",
            source: "DeviceConnectionStateEvents",
            condition: "true",
            endpointNames: [iothubEndpointEventhub.name],
            enabled: true,
            iothubName: this.iothub.name,
            resourceGroupName: config.resourceGroup.name,
        })

        new IothubEnrichmentA(this, "IothubEnrichmentWithTenant", {
            iothubName: this.iothub.name,
            resourceGroupName: config.resourceGroup.name,
            key: "tenant",
            value: "$twin.tags.Tenant",
            endpointNames: [iothubEndpointEventhub.name]
        })

    }
}