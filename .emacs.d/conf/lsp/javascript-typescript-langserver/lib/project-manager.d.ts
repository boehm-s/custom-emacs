import { Span } from 'opentracing';
import { Observable } from 'rxjs';
import * as ts from 'typescript';
import { Disposable } from './disposable';
import { FileSystemUpdater } from './fs';
import { Logger } from './logging';
import { InMemoryFileSystem } from './memfs';
import { PluginSettings } from './request-type';
/**
 * Implementaton of LanguageServiceHost that works with in-memory file system.
 * It takes file content from local cache and provides it to TS compiler on demand
 *
 * @implements ts.LanguageServiceHost
 */
export declare class InMemoryLanguageServiceHost implements ts.LanguageServiceHost {
    private logger;
    complete: boolean;
    /**
     * Root path
     */
    private rootPath;
    /**
     * Compiler options to use when parsing/analyzing source files.
     * We are extracting them from tsconfig.json or jsconfig.json
     */
    private options;
    /**
     * Local file cache where we looking for file content
     */
    private fs;
    /**
     * Current list of files that were implicitly added to project
     * (every time when we need to extract data from a file that we haven't touched yet).
     * Each item is a relative file path
     */
    private filePaths;
    /**
     * Current project version. When something significant is changed, incrementing it to signal TS compiler that
     * files should be updated and cached data should be invalidated
     */
    private projectVersion;
    /**
     * Tracks individual files versions to invalidate TS compiler data when single file is changed. Keys are URIs
     */
    private versions;
    constructor(rootPath: string, options: ts.CompilerOptions, fs: InMemoryFileSystem, versions: Map<string, number>, logger?: Logger);
    /**
     * TypeScript uses this method (when present) to compare project's version
     * with the last known one to decide if internal data should be synchronized
     */
    getProjectVersion(): string;
    getNewLine(): string;
    /**
     * Incrementing current project version, telling TS compiler to invalidate internal data
     */
    incProjectVersion(): void;
    getCompilationSettings(): ts.CompilerOptions;
    getScriptFileNames(): string[];
    /**
     * Adds a file and increments project version, used in conjunction with getProjectVersion()
     * which may be called by TypeScript to check if internal data is up to date
     *
     * @param filePath relative file path
     */
    addFile(filePath: string): void;
    /**
     * @param fileName absolute file path
     */
    getScriptVersion(filePath: string): string;
    /**
     * @param filePath absolute file path
     */
    getScriptSnapshot(filePath: string): ts.IScriptSnapshot | undefined;
    getCurrentDirectory(): string;
    getDefaultLibFileName(options: ts.CompilerOptions): string;
    trace(message: string): void;
    log(message: string): void;
    error(message: string): void;
    readFile(path: string, encoding?: string): string;
    fileExists(path: string): boolean;
}
/**
 * ProjectConfiguration instances track the compiler configuration (as
 * defined by {tj}sconfig.json if it exists) and state for a single
 * TypeScript project. It represents the world of the view as
 * presented to the compiler.
 *
 * For efficiency, a ProjectConfiguration instance may hide some files
 * from the compiler, preventing them from being parsed and
 * type-checked. Depending on the use, the caller should call one of
 * the ensure* methods to ensure that the appropriate files have been
 * made available to the compiler before calling any other methods on
 * the ProjectConfiguration or its public members. By default, no
 * files are parsed.
 *
 * Windows file paths are converted to UNIX-style forward slashes
 * when compared with Typescript configuration (isGlobalTSFile,
 * expectedFilePaths and typeRoots)
 */
export declare class ProjectConfiguration {
    private documentRegistry;
    private pluginSettings;
    private logger;
    private service?;
    /**
     * Object TS service will use to fetch content of source files
     */
    private host?;
    /**
     * Local file cache
     */
    private fs;
    /**
     * Relative path to configuration file (tsconfig.json/jsconfig.json)
     */
    configFilePath: string;
    /**
     * Configuration JSON object. May be used when there is no real configuration file to parse and use
     */
    private configContent;
    /**
     * Relative source file path (relative) -> version associations
     */
    private versions;
    /**
     * Enables module resolution tracing (done by TS service)
     */
    private traceModuleResolution;
    /**
     * Root file path, relative to workspace hierarchy root
     */
    private rootFilePath;
    /**
     * List of files that project consist of (based on tsconfig includes/excludes and wildcards).
     * Each item is a relative UNIX-like file path
     */
    private expectedFilePaths;
    /**
     * List of resolved extra root directories to allow global type declaration files to be loaded from.
     * Each item is an absolute UNIX-like file path
     */
    private typeRoots;
    private initialized;
    private ensuredAllFiles;
    private ensuredBasicFiles;
    /**
     * @param fs file system to use
     * @param documentRegistry Shared DocumentRegistry that manages SourceFile objects
     * @param rootFilePath root file path, absolute
     * @param configFilePath configuration file path, absolute
     * @param configContent optional configuration content to use instead of reading configuration file)
     */
    constructor(fs: InMemoryFileSystem, documentRegistry: ts.DocumentRegistry, rootFilePath: string, versions: Map<string, number>, configFilePath: string, configContent?: any, traceModuleResolution?: boolean, pluginSettings?: PluginSettings | undefined, logger?: Logger);
    /**
     * reset resets a ProjectConfiguration to its state immediately
     * after construction. It should be called whenever the underlying
     * local filesystem (fs) has changed, and so the
     * ProjectConfiguration can no longer assume its state reflects
     * that of the underlying files.
     */
    reset(): void;
    /**
     * @return language service object
     */
    getService(): ts.LanguageService;
    /**
     * Tells TS service to recompile program (if needed) based on current list of files and compilation options.
     * TS service relies on information provided by language servide host to see if there were any changes in
     * the whole project or in some files
     *
     * @return program object (cached result of parsing and typechecking done by TS service)
     */
    getProgram(childOf?: Span): ts.Program | undefined;
    /**
     * @return language service host that TS service uses to read the data
     */
    getHost(): InMemoryLanguageServiceHost;
    /**
     * Initializes (sub)project by parsing configuration and making proper internal objects
     */
    private init(span?);
    /**
     * Replaces the LanguageService with an instance wrapped by the plugin
     * @param pluginModuleFactory function to create the module
     * @param configEntry extra settings from tsconfig to pass to the plugin module
     */
    private wrapService(pluginModuleFactory, configEntry);
    /**
     * Ensures we are ready to process files from a given sub-project
     */
    ensureConfigFile(span?: Span): void;
    /**
     * Determines if a fileName is a declaration file within expected files or type roots
     * @param fileName A Unix-like absolute file path.
     */
    isExpectedDeclarationFile(fileName: string): boolean;
    /**
     * Ensures we added basic files (global TS files, dependencies, declarations)
     */
    ensureBasicFiles(span?: Span): void;
    /**
     * Ensures a single file is available to the LanguageServiceHost
     * @param filePath
     */
    ensureSourceFile(filePath: string, span?: Span): void;
    /**
     * Ensures we added all project's source file (as were defined in tsconfig.json)
     */
    ensureAllFiles(span?: Span): void;
}
export declare type ConfigType = 'js' | 'ts';
/**
 * ProjectManager translates VFS files to one or many projects denoted by [tj]config.json.
 * It uses either local or remote file system to fetch directory tree and files from and then
 * makes one or more LanguageService objects. By default all LanguageService objects contain no files,
 * they are added on demand - current file for hover or definition, project's files for references and
 * all files from all projects for workspace symbols.
 *
 * ProjectManager preserves Windows paths until passed to ProjectConfiguration or TS APIs.
 */
export declare class ProjectManager implements Disposable {
    protected logger: Logger;
    /**
     * Root path with slashes
     */
    private rootPath;
    /**
     * (Workspace subtree (folder) -> TS or JS configuration) mapping.
     * Configuration settings for a source file A are located in the closest parent folder of A.
     * Map keys are relative (to workspace root) paths
     */
    private configs;
    /**
     * Local side of file content provider which keeps cache of fetched files
     */
    private inMemoryFs;
    /**
     * File system updater that takes care of updating the in-memory file system
     */
    private updater;
    /**
     * URI -> version map. Every time file content is about to change or changed (didChange/didOpen/...), we are incrementing it's version
     * signalling that file is changed and file's user must invalidate cached and requery file content
     */
    private versions;
    /**
     * Enables module resolution tracing by TS compiler
     */
    private traceModuleResolution;
    /**
     * Flag indicating that we fetched module struture (tsconfig.json, jsconfig.json, package.json files) from the remote file system.
     * Without having this information we won't be able to split workspace to sub-projects
     */
    private ensuredModuleStructure?;
    /**
     * Observable that completes when extra dependencies pointed to by tsconfig.json have been loaded.
     */
    private ensuredConfigDependencies?;
    /**
     * Observable that completes when `ensureAllFiles` completed
     */
    private ensuredAllFiles?;
    /**
     * Observable that completes when `ensureOwnFiles` completed
     */
    private ensuredOwnFiles?;
    /**
     * A URI Map from file to files referenced by the file, so files only need to be pre-processed once
     */
    private referencedFiles;
    /**
     * Tracks all Subscriptions that are done in the lifetime of this object to dispose on `dispose()`
     */
    private subscriptions;
    /**
     * Options passed to the language server at startup
     */
    private pluginSettings?;
    /**
     * @param rootPath root path as passed to `initialize`
     * @param inMemoryFileSystem File system that keeps structure and contents in memory
     * @param strict indicates if we are working in strict mode (VFS) or with a local file system
     * @param traceModuleResolution allows to enable module resolution tracing (done by TS compiler)
     */
    constructor(rootPath: string, inMemoryFileSystem: InMemoryFileSystem, updater: FileSystemUpdater, traceModuleResolution?: boolean, pluginSettings?: PluginSettings, logger?: Logger);
    /**
     * Disposes the object (removes all registered listeners)
     */
    dispose(): void;
    /**
     * @return root path (as passed to `initialize`)
     */
    getRemoteRoot(): string;
    /**
     * @return local side of file content provider which keeps cached copies of fethed files
     */
    getFs(): InMemoryFileSystem;
    /**
     * @param filePath file path (both absolute or relative file paths are accepted)
     * @return true if there is a fetched file with a given path
     */
    hasFile(filePath: string): boolean;
    /**
     * @return all sub-projects we have identified for a given workspace.
     * Sub-project is mainly a folder which contains tsconfig.json, jsconfig.json, package.json,
     * or a root folder which serves as a fallback
     */
    configurations(): IterableIterator<ProjectConfiguration>;
    /**
     * Ensures that the module structure of the project exists in memory.
     * TypeScript/JavaScript module structure is determined by [jt]sconfig.json,
     * filesystem layout, global*.d.ts and package.json files.
     * Then creates new ProjectConfigurations, resets existing and invalidates file references.
     */
    ensureModuleStructure(childOf?: Span): Observable<never>;
    /**
     * Invalidates caches for `ensureModuleStructure`, `ensureAllFiles` and `insureOwnFiles`
     */
    invalidateModuleStructure(): void;
    /**
     * Ensures all files not in node_modules were fetched.
     * This includes all js/ts files, tsconfig files and package.json files.
     * Invalidates project configurations after execution
     */
    ensureOwnFiles(childOf?: Span): Observable<never>;
    /**
     * Ensures all files were fetched from the remote file system.
     * Invalidates project configurations after execution
     */
    ensureAllFiles(childOf?: Span): Observable<never>;
    /**
     * Recursively collects file(s) dependencies up to given level.
     * Dependencies are extracted by TS compiler from import and reference statements
     *
     * Dependencies include:
     * - all the configuration files
     * - files referenced by the given file
     * - files included by the given file
     *
     * The return values of this method are not cached, but those of the file fetching and file processing are.
     *
     * @param uri File to process
     * @param maxDepth Stop collecting when reached given recursion level
     * @param ignore Tracks visited files to prevent cycles
     * @param childOf OpenTracing parent span for tracing
     * @return Observable of file URIs ensured
     */
    ensureReferencedFiles(uri: string, maxDepth?: number, ignore?: Set<string>, childOf?: Span): Observable<string>;
    /**
     * Determines if a tsconfig/jsconfig needs additional declaration files loaded.
     * @param filePath A UNIX-like absolute file path
     */
    isConfigDependency(filePath: string): boolean;
    /**
     * Loads files determined by tsconfig to be needed into the file system
     */
    ensureConfigDependencies(childOf?: Span): Observable<never>;
    /**
     * Invalidates a cache entry for `resolveReferencedFiles` (e.g. because the file changed)
     *
     * @param uri The URI that referenced files should be invalidated for. If not given, all entries are invalidated
     */
    invalidateReferencedFiles(uri?: string): void;
    /**
     * Returns the files that are referenced from a given file.
     * If the file has already been processed, returns a cached value.
     *
     * @param uri URI of the file to process
     * @return URIs of files referenced by the file
     */
    private resolveReferencedFiles(uri, span?);
    /**
     * @param filePath source file path, absolute
     * @return project configuration for a given source file. Climbs directory tree up to workspace root if needed
     */
    getConfiguration(filePath: string, configType?: ConfigType): ProjectConfiguration;
    /**
     * @param filePath source file path, absolute
     * @return closest configuration for a given file path or undefined if there is no such configuration
     */
    getConfigurationIfExists(filePath: string, configType?: ConfigType): ProjectConfiguration | undefined;
    /**
     * Returns the ProjectConfiguration a file belongs to
     */
    getParentConfiguration(uri: string, configType?: ConfigType): ProjectConfiguration | undefined;
    /**
     * Returns all ProjectConfigurations contained in the given directory or one of its childrens
     *
     * @param uri URI of a directory
     */
    getChildConfigurations(uri: string): IterableIterator<ProjectConfiguration>;
    /**
     * Called when file was opened by client. Current implementation
     * does not differenciates open and change events
     * @param uri file's URI
     * @param text file's content
     */
    didOpen(uri: string, text: string): void;
    /**
     * Called when file was closed by client. Current implementation invalidates compiled version
     * @param uri file's URI
     */
    didClose(uri: string, span?: Span): void;
    /**
     * Called when file was changed by client. Current implementation invalidates compiled version
     * @param uri file's URI
     * @param text file's content
     */
    didChange(uri: string, text: string, span?: Span): void;
    /**
     * Called when file was saved by client
     * @param uri file's URI
     */
    didSave(uri: string): void;
    /**
     * @param filePath path to source (or config) file
     * @return configuration type to use for a given file
     */
    private getConfigurationType(filePath);
}