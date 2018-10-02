import { Operation } from 'fast-json-patch';
import { Span } from 'opentracing';
import { Observable } from 'rxjs';
import * as ts from 'typescript';
import { CodeActionParams, DidChangeConfigurationParams, DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams, DidSaveTextDocumentParams, DocumentSymbolParams, ExecuteCommandParams, Hover, Location, ReferenceParams, RenameParams, SymbolInformation, TextDocumentPositionParams } from 'vscode-languageserver';
import { FileSystem, FileSystemUpdater } from './fs';
import { LanguageClient } from './lang-handler';
import { Logger } from './logging';
import { InMemoryFileSystem } from './memfs';
import { PackageManager } from './packages';
import { ProjectConfiguration, ProjectManager } from './project-manager';
import { CompletionItem, InitializeParams, PackageDescriptor, PluginSettings, SymbolDescriptor, SymbolLocationInformation, WorkspaceReferenceParams, WorkspaceSymbolParams } from './request-type';
export interface TypeScriptServiceOptions {
    traceModuleResolution?: boolean;
    strict?: boolean;
}
export declare type TypeScriptServiceFactory = (client: LanguageClient, options?: TypeScriptServiceOptions) => TypeScriptService;
/**
 * Settings synced through `didChangeConfiguration`
 */
export interface Settings extends PluginSettings {
    format: ts.FormatCodeSettings;
}
/**
 * Handles incoming requests and return responses. There is a one-to-one-to-one
 * correspondence between TCP connection, TypeScriptService instance, and
 * language workspace. TypeScriptService caches data from the compiler across
 * requests. The lifetime of the TypeScriptService instance is tied to the
 * lifetime of the TCP connection, so its caches are deleted after the
 * connection is torn down.
 *
 * Methods are camelCase versions of the LSP spec methods and dynamically
 * dispatched. Methods not to be exposed over JSON RPC are prefixed with an
 * underscore.
 */
export declare class TypeScriptService {
    protected client: LanguageClient;
    protected options: TypeScriptServiceOptions;
    projectManager: ProjectManager;
    /**
     * The rootPath as passed to `initialize` or converted from `rootUri`
     */
    root: string;
    /**
     * The root URI as passed to `initialize` or converted from `rootPath`
     */
    protected rootUri: string;
    /**
     * Cached response for empty workspace/symbol query
     */
    private emptyQueryWorkspaceSymbols;
    private traceModuleResolution;
    /**
     * The remote (or local), asynchronous, file system to fetch files from
     */
    protected fileSystem: FileSystem;
    protected logger: Logger;
    /**
     * Holds file contents and workspace structure in memory
     */
    protected inMemoryFileSystem: InMemoryFileSystem;
    /**
     * Syncs the remote file system with the in-memory file system
     */
    protected updater: FileSystemUpdater;
    /**
     * Emits true or false depending on whether the root package.json is named "definitely-typed".
     * On DefinitelyTyped, files are not prefetched and a special workspace/symbol algorithm is used.
     */
    protected isDefinitelyTyped: Observable<boolean>;
    /**
     * Keeps track of package.jsons in the workspace
     */
    protected packageManager: PackageManager;
    /**
     * Settings synced though `didChangeConfiguration`
     */
    protected settings: Settings;
    /**
     * Indicates if the client prefers completion results formatted as snippets.
     */
    private supportsCompletionWithSnippets;
    constructor(client: LanguageClient, options?: TypeScriptServiceOptions);
    /**
     * The initialize request is sent as the first request from the client to the server. If the
     * server receives request or notification before the `initialize` request it should act as
     * follows:
     *
     * - for a request the respond should be errored with `code: -32002`. The message can be picked by
     * the server.
     * - notifications should be dropped, except for the exit notification. This will allow the exit a
     * server without an initialize request.
     *
     * Until the server has responded to the `initialize` request with an `InitializeResult` the
     * client must not sent any additional requests or notifications to the server.
     *
     * During the `initialize` request the server is allowed to sent the notifications
     * `window/showMessage`, `window/logMessage` and `telemetry/event` as well as the
     * `window/showMessageRequest` request to the client.
     *
     * @return Observable of JSON Patches that build an `InitializeResult`
     */
    initialize(params: InitializeParams, span?: Span): Observable<Operation>;
    /**
     * Initializes the remote file system and in-memory file system.
     * Can be overridden
     *
     * @param accessDisk Whether the language server is allowed to access the local file system
     */
    protected _initializeFileSystems(accessDisk: boolean): void;
    /**
     * The shutdown request is sent from the client to the server. It asks the server to shut down,
     * but to not exit (otherwise the response might not be delivered correctly to the client).
     * There is a separate exit notification that asks the server to exit.
     *
     * @return Observable of JSON Patches that build a `null` result
     */
    shutdown(params?: {}, span?: Span): Observable<Operation>;
    /**
     * A notification sent from the client to the server to signal the change of configuration
     * settings.
     */
    workspaceDidChangeConfiguration(params: DidChangeConfigurationParams): void;
    /**
     * The goto definition request is sent from the client to the server to resolve the definition
     * location of a symbol at a given text document position.
     *
     * @return Observable of JSON Patches that build a `Location[]` result
     */
    textDocumentDefinition(params: TextDocumentPositionParams, span?: Span): Observable<Operation>;
    /**
     * Returns an Observable of all definition locations found for a symbol.
     */
    protected _getDefinitionLocations(params: TextDocumentPositionParams, span?: Span): Observable<Location>;
    /**
     * This method is the same as textDocument/definition, except that:
     *
     * - The method returns metadata about the definition (the same metadata that
     * workspace/xreferences searches for).
     * - The concrete location to the definition (location field)
     * is optional. This is useful because the language server might not be able to resolve a goto
     * definition request to a concrete location (e.g. due to lack of dependencies) but still may
     * know some information about it.
     *
     * @return Observable of JSON Patches that build a `SymbolLocationInformation[]` result
     */
    textDocumentXdefinition(params: TextDocumentPositionParams, span?: Span): Observable<Operation>;
    /**
     * Returns an Observable of SymbolLocationInformations for the definition of a symbol at the given position
     */
    protected _getSymbolLocationInformations(params: TextDocumentPositionParams, span?: Span): Observable<SymbolLocationInformation>;
    /**
     * Finds the PackageDescriptor a given file belongs to
     *
     * @return Observable that emits a single PackageDescriptor or never if the definition does not belong to any package
     */
    protected _getPackageDescriptor(uri: string, childOf?: Span): Observable<PackageDescriptor>;
    /**
     * The hover request is sent from the client to the server to request hover information at a
     * given text document position.
     *
     * @return Observable of JSON Patches that build a `Hover` result
     */
    textDocumentHover(params: TextDocumentPositionParams, span?: Span): Observable<Operation>;
    /**
     * Returns an Observable for a Hover at the given position
     */
    protected _getHover(params: TextDocumentPositionParams, span?: Span): Observable<Hover>;
    /**
     * The references request is sent from the client to the server to resolve project-wide
     * references for the symbol denoted by the given text document position.
     *
     * Returns all references to the symbol at the position in the own workspace, including references inside node_modules.
     *
     * @return Observable of JSON Patches that build a `Location[]` result
     */
    textDocumentReferences(params: ReferenceParams, span?: Span): Observable<Operation>;
    /**
     * The workspace symbol request is sent from the client to the server to list project-wide
     * symbols matching the query string. The text document parameter specifies the active document
     * at time of the query. This can be used to rank or limit results.
     *
     * @return Observable of JSON Patches that build a `SymbolInformation[]` result
     */
    workspaceSymbol(params: WorkspaceSymbolParams, span?: Span): Observable<Operation>;
    /**
     * The document symbol request is sent from the client to the server to list all symbols found
     * in a given text document.
     *
     * @return Observable of JSON Patches that build a `SymbolInformation[]` result
     */
    textDocumentDocumentSymbol(params: DocumentSymbolParams, span?: Span): Observable<Operation>;
    /**
     * The workspace references request is sent from the client to the server to locate project-wide
     * references to a symbol given its description / metadata.
     *
     * @return Observable of JSON Patches that build a `ReferenceInformation[]` result
     */
    workspaceXreferences(params: WorkspaceReferenceParams, span?: Span): Observable<Operation>;
    /**
     * This method returns metadata about the package(s) defined in a workspace and a list of
     * dependencies for each package.
     *
     * This method is necessary to implement cross-repository jump-to-def when it is not possible to
     * resolve the global location of the definition from data present or derived from the local
     * workspace. For example, a package manager might not include information about the source
     * repository of each dependency. In this case, definition resolution requires mapping from
     * package descriptor to repository revision URL. A reverse index can be constructed from calls
     * to workspace/xpackages to provide an efficient mapping.
     *
     * @return Observable of JSON Patches that build a `PackageInformation[]` result
     */
    workspaceXpackages(params?: {}, span?: Span): Observable<Operation>;
    /**
     * Returns all dependencies of a workspace.
     * Superseded by workspace/xpackages
     *
     * @return Observable of JSON Patches that build a `DependencyReference[]` result
     */
    workspaceXdependencies(params?: {}, span?: Span): Observable<Operation>;
    /**
     * The Completion request is sent from the client to the server to compute completion items at a
     * given cursor position. Completion items are presented in the
     * [IntelliSense](https://code.visualstudio.com/docs/editor/editingevolved#_intellisense) user
     * interface. If computing full completion items is expensive, servers can additionally provide
     * a handler for the completion item resolve request ('completionItem/resolve'). This request is
     * sent when a completion item is selected in the user interface. A typically use case is for
     * example: the 'textDocument/completion' request doesn't fill in the `documentation` property
     * for returned completion items since it is expensive to compute. When the item is selected in
     * the user interface then a 'completionItem/resolve' request is sent with the selected
     * completion item as a param. The returned completion item should have the documentation
     * property filled in.
     *
     * @return Observable of JSON Patches that build a `CompletionList` result
     */
    textDocumentCompletion(params: TextDocumentPositionParams, span?: Span): Observable<Operation>;
    /**
     * The completionItem/resolve request is used to fill in additional details from an incomplete
     * CompletionItem returned from the textDocument/completions call.
     *
     * @return Observable of JSON Patches that build a `CompletionItem` result
     */
    completionItemResolve(item: CompletionItem, span?: Span): Observable<Operation>;
    /**
     * The signature help request is sent from the client to the server to request signature
     * information at a given cursor position.
     *
     * @return Observable of JSON Patches that build a `SignatureHelp` result
     */
    textDocumentSignatureHelp(params: TextDocumentPositionParams, span?: Span): Observable<Operation>;
    /**
     * The code action request is sent from the client to the server to compute commands for a given
     * text document and range. These commands are typically code fixes to either fix problems or to
     * beautify/refactor code.
     *
     * @return Observable of JSON Patches that build a `Command[]` result
     */
    textDocumentCodeAction(params: CodeActionParams, span?: Span): Observable<Operation>;
    /**
     * The workspace/executeCommand request is sent from the client to the server to trigger command
     * execution on the server. In most cases the server creates a WorkspaceEdit structure and
     * applies the changes to the workspace using the request workspace/applyEdit which is sent from
     * the server to the client.
     */
    workspaceExecuteCommand(params: ExecuteCommandParams, span?: Span): Observable<Operation>;
    /**
     * Executes the `codeFix` command
     *
     * @return Observable of JSON Patches for `null` result
     */
    executeCodeFixCommand(fileTextChanges: ts.FileTextChanges[], span?: Span): Observable<Operation>;
    /**
     * The rename request is sent from the client to the server to perform a workspace-wide rename of a symbol.
     *
     * @return Observable of JSON Patches that build a `WorkspaceEdit` result
     */
    textDocumentRename(params: RenameParams, span?: Span): Observable<Operation>;
    /**
     * The initialized notification is sent from the client to the server after the client received
     * the result of the initialize request but before the client is sending any other request or
     * notification to the server. The server can use the initialized notification for example to
     * dynamically register capabilities.
     */
    initialized(): Promise<void>;
    /**
     * The document open notification is sent from the client to the server to signal newly opened
     * text documents. The document's truth is now managed by the client and the server must not try
     * to read the document's truth using the document's uri.
     */
    textDocumentDidOpen(params: DidOpenTextDocumentParams): Promise<void>;
    /**
     * The document change notification is sent from the client to the server to signal changes to a
     * text document. In 2.0 the shape of the params has changed to include proper version numbers
     * and language ids.
     */
    textDocumentDidChange(params: DidChangeTextDocumentParams): Promise<void>;
    /**
     * Generates and publishes diagnostics for a given file
     *
     * @param uri URI of the file to check
     */
    private _publishDiagnostics(uri, span?);
    /**
     * The document save notification is sent from the client to the server when the document was
     * saved in the client.
     */
    textDocumentDidSave(params: DidSaveTextDocumentParams): Promise<void>;
    /**
     * The document close notification is sent from the client to the server when the document got
     * closed in the client. The document's truth now exists where the document's uri points to
     * (e.g. if the document's uri is a file uri the truth now exists on disk).
     */
    textDocumentDidClose(params: DidCloseTextDocumentParams): Promise<void>;
    /**
     * Fetches (or creates if needed) source file object for a given file name
     *
     * @param configuration project configuration
     * @param fileName file name to fetch source file for or create it
     * @param span Span for tracing
     */
    protected _getSourceFile(configuration: ProjectConfiguration, fileName: string, span?: Span): ts.SourceFile | undefined;
    /**
     * Returns an Observable for all symbols in a given config that match a given SymbolDescriptor or text query
     *
     * @param config The ProjectConfiguration to search
     * @param query A text or SymbolDescriptor query
     * @return Observable of [match score, SymbolInformation]
     */
    protected _getSymbolsInConfig(config: ProjectConfiguration, query?: string | Partial<SymbolDescriptor>, childOf?: Span): Observable<[number, SymbolInformation]>;
}