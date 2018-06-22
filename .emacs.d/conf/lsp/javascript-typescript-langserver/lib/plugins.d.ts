import * as ts from 'typescript';
import { Logger, NoopLogger } from './logging';
import { PluginSettings } from './request-type';
/**
 * A plugin exports an initialization function, injected with
 * the current typescript instance
 */
export declare type PluginModuleFactory = (mod: {
    typescript: typeof ts;
}) => PluginModule;
export declare type EnableProxyFunc = (pluginModuleFactory: PluginModuleFactory, pluginConfigEntry: ts.PluginImport) => void;
/**
 * A plugin presents this API when initialized
 */
export interface PluginModule {
    create(createInfo: PluginCreateInfo): ts.LanguageService;
    getExternalFiles?(proj: Project): string[];
}
/**
 * All of tsserver's environment exposed to plugins
 */
export interface PluginCreateInfo {
    project: Project;
    languageService: ts.LanguageService;
    languageServiceHost: ts.LanguageServiceHost;
    serverHost: ServerHost;
    config: any;
}
/**
 * The portion of tsserver's Project API exposed to plugins
 */
export interface Project {
    projectService: {
        logger: Logger;
    };
    getCurrentDirectory(): string;
}
/**
 * A local filesystem-based ModuleResolutionHost for plugin loading.
 */
export declare class LocalModuleResolutionHost implements ts.ModuleResolutionHost {
    fileExists(fileName: string): boolean;
    readFile(fileName: string): string;
}
/**
 * The portion of tsserver's ServerHost API exposed to plugins
 */
export declare type ServerHost = object;
export declare class PluginLoader {
    private rootFilePath;
    private fs;
    private logger;
    private resolutionHost;
    private requireModule;
    private allowLocalPluginLoads;
    private globalPlugins;
    private pluginProbeLocations;
    constructor(rootFilePath: string, fs: ts.ModuleResolutionHost, pluginSettings?: PluginSettings, logger?: NoopLogger, resolutionHost?: LocalModuleResolutionHost, requireModule?: (moduleName: string) => any);
    loadPlugins(options: ts.CompilerOptions, applyProxy: EnableProxyFunc): void;
    /**
     * Tries to load and enable a single plugin
     * @param pluginConfigEntry
     * @param searchPaths
     */
    private enablePlugin(pluginConfigEntry, searchPaths, enableProxy);
    /**
     * Load a plugin using a node require
     * @param moduleName
     * @param initialDir
     */
    private resolveModule(moduleName, initialDir);
    /**
     * Resolves a loads a plugin function relative to initialDir
     * @param initialDir
     * @param moduleName
     */
    private requirePlugin(initialDir, moduleName);
    /**
     * Expose resolution logic to allow us to use Node module resolution logic from arbitrary locations.
     * No way to do this with `require()`: https://github.com/nodejs/node/issues/5963
     * Throws an error if the module can't be resolved.
     * stolen from moduleNameResolver.ts because marked as internal
     */
    private resolveJavaScriptModule(moduleName, initialDir, host);
}
