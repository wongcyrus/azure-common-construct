
import { Construct } from 'constructs'
import *  as path from 'path';
import { ResourceGroup } from "cdktf-azure-providers/.gen/providers/azurerm/resource-group"
import { WindowsFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/windows-function-app"
import { LinuxFunctionApp } from "cdktf-azure-providers/.gen/providers/azurerm/linux-function-app"
import { Resource } from "cdktf-azure-providers/.gen/providers/null/resource"
import { DataArchiveFile } from "cdktf-azure-providers/.gen/providers/archive/data-archive-file"
import { getAllFilesSync } from 'get-all-files'
import * as sha256File from 'sha256-file';
import * as sha256 from "fast-sha256";
import { TextDecoder, TextEncoder } from 'util'
import { DataExternal } from 'cdktf-azure-providers/.gen/providers/external/data-external';

export enum PublishMode {
    Always = 1,
    AfterCodeChange,
    Manual
}
export interface PublisherConstructConfig {
    readonly functionApp: WindowsFunctionApp | LinuxFunctionApp;
    readonly vsProjectPath: string;
    readonly publishMode: PublishMode;
    readonly functionNames?: string[]
    readonly resourceGroup: ResourceGroup
}

export class PublisherConstruct extends Construct {
    public readonly functionKeys?: { [key: string]: string };
    public readonly functionUrls?: { [key: string]: string };
    public readonly buildResource?: Resource;
    public readonly publishResource?: Resource;
    constructor(
        scope: Construct,
        name: string,
        config: PublisherConstructConfig
    ) {
        super(scope, name)

        if (config.publishMode !== PublishMode.Manual) {
            const vsProjectPath = config.vsProjectPath;

            let build_hash = "${timestamp()}";
            if (config.publishMode == PublishMode.AfterCodeChange) {
                const textEncoder = new TextEncoder();
                const textDecoder = new TextDecoder("utf-8");
                build_hash = textDecoder.decode(sha256.hash(textEncoder.encode(getAllFilesSync(vsProjectPath).toArray().filter(c => c.endsWith(".cs")).map(f => sha256File(f)).join())));
            }

            const buildFunctionAppResource = new Resource(this, "BuildFunctionAppResource",
                {
                    triggers: { build_hash: build_hash },
                    dependsOn: [config.functionApp]
                })

            buildFunctionAppResource.addOverride("provisioner", [
                {
                    "local-exec": {
                        working_dir: vsProjectPath,
                        command: "dotnet publish -p:PublishProfile=FolderProfile"
                    },
                },
            ]);
            const publishPath = path.join(vsProjectPath, "/bin/Release/publish/azfunction");
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
                        command: `az functionapp deployment source config-zip --resource-group ${config.resourceGroup.name} --name ${config.functionApp.name} --src ${dataArchiveFile.outputPath}`
                    },
                },
            ]);

            if (config.functionNames) {
                const psScriptPath = path.join(__dirname, "GetFunctionKey.sh");
                this.functionKeys = {};
                this.functionUrls = {};
                for (const functionName of config.functionNames) {
                    const functionKeyExternal = new DataExternal(this, functionName + "FunctionKeyExternal", {
                        program: ["bash", psScriptPath],
                        query: {
                            resourceGroup: config.resourceGroup.name,
                            functionAppName: config.functionApp.name,
                            functionName
                        },
                        dependsOn: [config.functionApp, publishFunctionAppResource]
                    })
                    const functionKey = functionKeyExternal.result.lookup("FunctionKey")
                    this.functionKeys[functionName] = functionKey
                    this.functionUrls[functionName] = `https://${config.functionApp.name}.azurewebsites.net/api/${functionName}?code=${functionKey}`
                }
            }

            // expose for external dependency chaining
            this.buildResource = buildFunctionAppResource;
            this.publishResource = publishFunctionAppResource;
        }

    }
}