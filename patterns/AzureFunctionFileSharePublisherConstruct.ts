
import { Construct } from 'constructs'
import *  as path from 'path';
import { StorageAccount } from "cdktf-azure-providers/.gen/providers/azurerm/storage-account"
import { WindowsFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/windows-function-app";
import { LinuxFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/linux-function-app";

import { Resource } from "cdktf-azure-providers/.gen/providers/null/resource"
import { getAllFilesSync } from 'get-all-files'
import * as sha256File from 'sha256-file';
import * as sha256 from "fast-sha256";
import { TextDecoder, TextEncoder } from 'util'
import { Fn } from 'cdktf';

export interface AzureFunctionFileSharePublisherConstructConfig {
    readonly functionApp: WindowsFunctionApp | LinuxFunctionApp;
    readonly localFolder: string;
    readonly functionFolder: string;
    readonly storageAccount: StorageAccount;   
}

export class AzureFunctionFileSharePublisherConstruct extends Construct {
    constructor(
        scope: Construct,
        name: string,
        config: AzureFunctionFileSharePublisherConstructConfig
    ) {
        super(scope, name)

        let build_hash = "${timestamp()}";

        const textEncoder = new TextEncoder();
        const textDecoder = new TextDecoder("utf-8");
        build_hash = textDecoder.decode(sha256.hash(textEncoder.encode(getAllFilesSync(config.localFolder).toArray().map(f => sha256File(f)).join())));

        const uploadFolderResource = new Resource(this, "UploadFolderResource",
            {
                triggers: { build_hash: build_hash },
                dependsOn: [config.functionApp]
            })
        const script = path.join(__dirname, "UploadFolderToFileShare.ps1");

        uploadFolderResource.addOverride("provisioner", [
            {
                "local-exec": {                
                    command: `${script}-connectionString \"${Fn.nonsensitive(config.storageAccount.primaryConnectionString)}\" -localFolder ${config.localFolder} -functionFolder ${config.functionFolder}`
                }
            },
        ]);
    }
}