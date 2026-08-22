import { readdirSync } from "fs";
import * as path from "path";

export function getAllFilePathsSync(directory: string): string[] {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.join(entry.parentPath, entry.name));
}
