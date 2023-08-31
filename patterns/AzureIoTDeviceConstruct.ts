import { Construct } from 'constructs'
import { Iothub } from "cdktf-azure-providers/.gen/providers/azurerm/iothub"
import { ResourceGroup } from "cdktf-azure-providers/.gen/providers/azurerm/resource-group"
import { DataExternal } from "cdktf-azure-providers/.gen/providers/external/data-external";
import *  as path from 'path';

export interface AzureIoTDeviceConfig {
    readonly deviceId: string
    readonly prefix: string
    readonly environment: string
    readonly resourceGroup: ResourceGroup
    readonly iothub: Iothub
}

export class AzureIotDeviceConstruct extends Construct {
    public readonly deviceKey: string;

    constructor(
        scope: Construct,
        name: string,
        config: AzureIoTDeviceConfig
    ) {
        super(scope, name)
        const psScriptPath = path.join(__dirname, "GetDeviceKey.ps1");
        const deviceKeyExternal = new DataExternal(this, "DeviceKeyExternal", {
            program: ["PowerShell", psScriptPath],
            query: {
                deviceId: config.deviceId,
                resourceGroup: config.resourceGroup.name,
                iotHubName: config.iothub.name
            },
            dependsOn: [config.iothub]
        })
        this.deviceKey = deviceKeyExternal.result.lookup("deviceKey")
    }
}