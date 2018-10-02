"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const lodash_1 = require("lodash");
const lodash_2 = require("lodash");
const hashObject = require("object-hash");
const opentracing_1 = require("opentracing");
const rxjs_1 = require("rxjs");
const ts = require("typescript");
const url = require("url");
const vscode_languageserver_1 = require("vscode-languageserver");
const ast_1 = require("./ast");
const diagnostics_1 = require("./diagnostics");
const fs_1 = require("./fs");
const logging_1 = require("./logging");
const memfs_1 = require("./memfs");
const packages_1 = require("./packages");
const project_manager_1 = require("./project-manager");
const symbols_1 = require("./symbols");
const tracing_1 = require("./tracing");
const util_1 = require("./util");
/**
 * Maps string-based CompletionEntry::kind to enum-based CompletionItemKind
 */
const completionKinds = new Map([
    [`class`, vscode_languageserver_1.CompletionItemKind.Class],
    [`constructor`, vscode_languageserver_1.CompletionItemKind.Constructor],
    [`enum`, vscode_languageserver_1.CompletionItemKind.Enum],
    [`field`, vscode_languageserver_1.CompletionItemKind.Field],
    [`file`, vscode_languageserver_1.CompletionItemKind.File],
    [`function`, vscode_languageserver_1.CompletionItemKind.Function],
    [`interface`, vscode_languageserver_1.CompletionItemKind.Interface],
    [`keyword`, vscode_languageserver_1.CompletionItemKind.Keyword],
    [`method`, vscode_languageserver_1.CompletionItemKind.Method],
    [`module`, vscode_languageserver_1.CompletionItemKind.Module],
    [`property`, vscode_languageserver_1.CompletionItemKind.Property],
    [`reference`, vscode_languageserver_1.CompletionItemKind.Reference],
    [`snippet`, vscode_languageserver_1.CompletionItemKind.Snippet],
    [`text`, vscode_languageserver_1.CompletionItemKind.Text],
    [`unit`, vscode_languageserver_1.CompletionItemKind.Unit],
    [`value`, vscode_languageserver_1.CompletionItemKind.Value],
    [`variable`, vscode_languageserver_1.CompletionItemKind.Variable],
]);
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
class TypeScriptService {
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
        /**
         * Settings synced though `didChangeConfiguration`
         */
        this.settings = {
            format: {
                tabSize: 4,
                indentSize: 4,
                newLineCharacter: '\n',
                convertTabsToSpaces: false,
                insertSpaceAfterCommaDelimiter: true,
                insertSpaceAfterSemicolonInForStatements: true,
                insertSpaceBeforeAndAfterBinaryOperators: true,
                insertSpaceAfterKeywordsInControlFlowStatements: true,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
                insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
                insertSpaceBeforeFunctionParenthesis: false,
                placeOpenBraceOnNewLineForFunctions: false,
                placeOpenBraceOnNewLineForControlBlocks: false,
            },
            allowLocalPluginLoads: false,
            globalPlugins: [],
            pluginProbeLocations: [],
        };
        /**
         * Indicates if the client prefers completion results formatted as snippets.
         */
        this.supportsCompletionWithSnippets = false;
        this.logger = new logging_1.LSPLogger(client);
    }
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
    initialize(params, span = new opentracing_1.Span()) {
        // tslint:disable:deprecation
        if (params.rootUri || params.rootPath) {
            this.root = params.rootPath || util_1.uri2path(params.rootUri);
            this.rootUri = params.rootUri || util_1.path2uri(params.rootPath);
            // tslint:enable:deprecation
            this.supportsCompletionWithSnippets =
                (params.capabilities.textDocument &&
                    params.capabilities.textDocument.completion &&
                    params.capabilities.textDocument.completion.completionItem &&
                    params.capabilities.textDocument.completion.completionItem.snippetSupport) ||
                    false;
            // The root URI always refers to a directory
            if (!this.rootUri.endsWith('/')) {
                this.rootUri += '/';
            }
            this._initializeFileSystems(!this.options.strict && !(params.capabilities.xcontentProvider && params.capabilities.xfilesProvider));
            this.updater = new fs_1.FileSystemUpdater(this.fileSystem, this.inMemoryFileSystem);
            this.projectManager = new project_manager_1.ProjectManager(this.root, this.inMemoryFileSystem, this.updater, this.traceModuleResolution, this.settings, this.logger);
            this.packageManager = new packages_1.PackageManager(this.updater, this.inMemoryFileSystem, this.logger);
            // Detect DefinitelyTyped
            // Fetch root package.json (if exists)
            const normRootUri = this.rootUri.endsWith('/') ? this.rootUri : this.rootUri + '/';
            const packageJsonUri = normRootUri + 'package.json';
            this.isDefinitelyTyped = rxjs_1.Observable.from(this.packageManager.getPackageJson(packageJsonUri, span))
                // Check name
                .map(packageJson => packageJson.name === 'definitely-typed')
                .catch(err => [false])
                .publishReplay()
                .refCount();
            // Pre-fetch files in the background if not DefinitelyTyped
            this.isDefinitelyTyped
                .mergeMap(isDefinitelyTyped => {
                if (!isDefinitelyTyped) {
                    return this.projectManager.ensureOwnFiles(span);
                }
                return [];
            })
                .subscribe(undefined, err => {
                this.logger.error(err);
            });
        }
        const result = {
            capabilities: {
                // Tell the client that the server works in FULL text document sync mode
                textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Full,
                hoverProvider: true,
                signatureHelpProvider: {
                    triggerCharacters: ['(', ','],
                },
                definitionProvider: true,
                referencesProvider: true,
                documentSymbolProvider: true,
                workspaceSymbolProvider: true,
                xworkspaceReferencesProvider: true,
                xdefinitionProvider: true,
                xdependenciesProvider: true,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.'],
                },
                codeActionProvider: true,
                renameProvider: true,
                executeCommandProvider: {
                    commands: [],
                },
                xpackagesProvider: true,
            },
        };
        return rxjs_1.Observable.of({
            op: 'add',
            path: '',
            value: result,
        });
    }
    /**
     * Initializes the remote file system and in-memory file system.
     * Can be overridden
     *
     * @param accessDisk Whether the language server is allowed to access the local file system
     */
    _initializeFileSystems(accessDisk) {
        this.fileSystem = accessDisk ? new fs_1.LocalFileSystem(this.rootUri) : new fs_1.RemoteFileSystem(this.client);
        this.inMemoryFileSystem = new memfs_1.InMemoryFileSystem(this.root, this.logger);
    }
    /**
     * The shutdown request is sent from the client to the server. It asks the server to shut down,
     * but to not exit (otherwise the response might not be delivered correctly to the client).
     * There is a separate exit notification that asks the server to exit.
     *
     * @return Observable of JSON Patches that build a `null` result
     */
    shutdown(params = {}, span = new opentracing_1.Span()) {
        this.projectManager.dispose();
        this.packageManager.dispose();
        return rxjs_1.Observable.of({ op: 'add', path: '', value: null });
    }
    /**
     * A notification sent from the client to the server to signal the change of configuration
     * settings.
     */
    workspaceDidChangeConfiguration(params) {
        lodash_1.merge(this.settings, params.settings);
    }
    /**
     * The goto definition request is sent from the client to the server to resolve the definition
     * location of a symbol at a given text document position.
     *
     * @return Observable of JSON Patches that build a `Location[]` result
     */
    textDocumentDefinition(params, span = new opentracing_1.Span()) {
        return this._getDefinitionLocations(params, span)
            .map((location) => ({ op: 'add', path: '/-', value: location }))
            .startWith({ op: 'add', path: '', value: [] });
    }
    /**
     * Returns an Observable of all definition locations found for a symbol.
     */
    _getDefinitionLocations(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Fetch files needed to resolve definition
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .mergeMap(() => {
            const fileName = util_1.uri2path(uri);
            const configuration = this.projectManager.getConfiguration(fileName);
            configuration.ensureBasicFiles(span);
            const sourceFile = this._getSourceFile(configuration, fileName, span);
            if (!sourceFile) {
                throw new Error(`Expected source file ${fileName} to exist`);
            }
            const offset = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            const definitions = configuration
                .getService()
                .getDefinitionAtPosition(fileName, offset);
            return rxjs_1.Observable.from(definitions || []).map((definition) => {
                const sourceFile = this._getSourceFile(configuration, definition.fileName, span);
                if (!sourceFile) {
                    throw new Error('expected source file "' + definition.fileName + '" to exist in configuration');
                }
                const start = ts.getLineAndCharacterOfPosition(sourceFile, definition.textSpan.start);
                const end = ts.getLineAndCharacterOfPosition(sourceFile, definition.textSpan.start + definition.textSpan.length);
                return {
                    uri: symbols_1.locationUri(definition.fileName),
                    range: {
                        start,
                        end,
                    },
                };
            });
        });
    }
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
    textDocumentXdefinition(params, span = new opentracing_1.Span()) {
        return this._getSymbolLocationInformations(params, span)
            .map(symbol => ({ op: 'add', path: '/-', value: symbol }))
            .startWith({ op: 'add', path: '', value: [] });
    }
    /**
     * Returns an Observable of SymbolLocationInformations for the definition of a symbol at the given position
     */
    _getSymbolLocationInformations(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Ensure files needed to resolve SymbolLocationInformation are fetched
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .mergeMap(() => {
            // Convert URI to file path
            const fileName = util_1.uri2path(uri);
            // Get closest tsconfig configuration
            const configuration = this.projectManager.getConfiguration(fileName);
            configuration.ensureBasicFiles(span);
            const sourceFile = this._getSourceFile(configuration, fileName, span);
            if (!sourceFile) {
                throw new Error(`Unknown text document ${uri}`);
            }
            // Convert line/character to offset
            const offset = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            // Query TypeScript for references
            return rxjs_1.Observable.from(configuration.getService().getDefinitionAtPosition(fileName, offset) || []).mergeMap((definition) => {
                const definitionUri = symbols_1.locationUri(definition.fileName);
                // Get the PackageDescriptor
                return this._getPackageDescriptor(definitionUri)
                    .defaultIfEmpty(undefined)
                    .map((packageDescriptor) => {
                    const sourceFile = this._getSourceFile(configuration, definition.fileName, span);
                    if (!sourceFile) {
                        throw new Error(`Expected source file ${definition.fileName} to exist in configuration`);
                    }
                    const symbol = symbols_1.definitionInfoToSymbolDescriptor(definition, this.root);
                    if (packageDescriptor) {
                        symbol.package = packageDescriptor;
                    }
                    return {
                        symbol,
                        location: {
                            uri: definitionUri,
                            range: {
                                start: ts.getLineAndCharacterOfPosition(sourceFile, definition.textSpan.start),
                                end: ts.getLineAndCharacterOfPosition(sourceFile, definition.textSpan.start + definition.textSpan.length),
                            },
                        },
                    };
                });
            });
        });
    }
    /**
     * Finds the PackageDescriptor a given file belongs to
     *
     * @return Observable that emits a single PackageDescriptor or never if the definition does not belong to any package
     */
    _getPackageDescriptor(uri, childOf = new opentracing_1.Span()) {
        return tracing_1.traceObservable('Get PackageDescriptor', childOf, span => {
            span.addTags({ uri });
            // Get package name of the dependency in which the symbol is defined in, if any
            const packageName = packages_1.extractNodeModulesPackageName(uri);
            if (packageName) {
                // The symbol is part of a dependency in node_modules
                // Build URI to package.json of the Dependency
                const encodedPackageName = packageName
                    .split('/')
                    .map(encodeURIComponent)
                    .join('/');
                const parts = url.parse(uri);
                const packageJsonUri = url.format(Object.assign({}, parts, { pathname: parts.pathname.slice(0, parts.pathname.lastIndexOf('/node_modules/' + encodedPackageName)) +
                        `/node_modules/${encodedPackageName}/package.json` }));
                // Fetch the package.json of the dependency
                return this.updater.ensure(packageJsonUri, span).concat(rxjs_1.Observable.defer(() => {
                    const packageJson = JSON.parse(this.inMemoryFileSystem.getContent(packageJsonUri));
                    const { name, version } = packageJson;
                    if (!name) {
                        return rxjs_1.Observable.empty();
                    }
                    // Used by the LSP proxy to shortcut database lookup of repo URL for PackageDescriptor
                    let repoURL;
                    if (name.startsWith('@types/')) {
                        // if the dependency package is an @types/ package, point the repo to DefinitelyTyped
                        repoURL = 'https://github.com/DefinitelyTyped/DefinitelyTyped';
                    }
                    else {
                        // else use repository field from package.json
                        repoURL =
                            typeof packageJson.repository === 'object' ? packageJson.repository.url : undefined;
                    }
                    return rxjs_1.Observable.of({ name, version, repoURL });
                }));
            }
            else {
                // The symbol is defined in the root package of the workspace, not in a dependency
                // Get root package.json
                return this.packageManager.getClosestPackageJson(uri, span).mergeMap(packageJson => {
                    let { name, version } = packageJson;
                    if (!name) {
                        return [];
                    }
                    let repoURL = typeof packageJson.repository === 'object' ? packageJson.repository.url : undefined;
                    // If the root package is DefinitelyTyped, find out the proper @types package name for each typing
                    if (name === 'definitely-typed') {
                        name = packages_1.extractDefinitelyTypedPackageName(uri);
                        if (!name) {
                            this.logger.error(`Could not extract package name from DefinitelyTyped URI ${uri}`);
                            return [];
                        }
                        version = undefined;
                        repoURL = 'https://github.com/DefinitelyTyped/DefinitelyTyped';
                    }
                    return [{ name, version, repoURL }];
                });
            }
        });
    }
    /**
     * The hover request is sent from the client to the server to request hover information at a
     * given text document position.
     *
     * @return Observable of JSON Patches that build a `Hover` result
     */
    textDocumentHover(params, span = new opentracing_1.Span()) {
        return this._getHover(params, span).map(hover => ({ op: 'add', path: '', value: hover }));
    }
    /**
     * Returns an Observable for a Hover at the given position
     */
    _getHover(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Ensure files needed to resolve hover are fetched
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .map(() => {
            const fileName = util_1.uri2path(uri);
            const configuration = this.projectManager.getConfiguration(fileName);
            configuration.ensureBasicFiles(span);
            const sourceFile = this._getSourceFile(configuration, fileName, span);
            if (!sourceFile) {
                throw new Error(`Unknown text document ${uri}`);
            }
            const offset = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            const info = configuration.getService().getQuickInfoAtPosition(fileName, offset);
            if (!info) {
                return { contents: [] };
            }
            const contents = [];
            // Add declaration without the kind
            const declaration = ts.displayPartsToString(info.displayParts).replace(/^\(.+?\)\s+/, '');
            contents.push({ language: 'typescript', value: declaration });
            // Add kind with modifiers, e.g. "method (private, ststic)", "class (exported)"
            if (info.kind) {
                let kind = '**' + info.kind + '**';
                const modifiers = info.kindModifiers
                    .split(',')
                    // Filter out some quirks like "constructor (exported)"
                    .filter(mod => mod &&
                    (mod !== ts.ScriptElementKindModifier.exportedModifier ||
                        info.kind !== ts.ScriptElementKind.constructorImplementationElement))
                    // Make proper adjectives
                    .map(mod => {
                    switch (mod) {
                        case ts.ScriptElementKindModifier.ambientModifier:
                            return 'ambient';
                        case ts.ScriptElementKindModifier.exportedModifier:
                            return 'exported';
                        default:
                            return mod;
                    }
                });
                if (modifiers.length > 0) {
                    kind += ' _(' + modifiers.join(', ') + ')_';
                }
                contents.push(kind);
            }
            // Add documentation
            const documentation = ts.displayPartsToString(info.documentation);
            if (documentation) {
                contents.push(documentation);
            }
            const start = ts.getLineAndCharacterOfPosition(sourceFile, info.textSpan.start);
            const end = ts.getLineAndCharacterOfPosition(sourceFile, info.textSpan.start + info.textSpan.length);
            return {
                contents,
                range: {
                    start,
                    end,
                },
            };
        });
    }
    /**
     * The references request is sent from the client to the server to resolve project-wide
     * references for the symbol denoted by the given text document position.
     *
     * Returns all references to the symbol at the position in the own workspace, including references inside node_modules.
     *
     * @return Observable of JSON Patches that build a `Location[]` result
     */
    textDocumentReferences(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Ensure all files were fetched to collect all references
        return (this.projectManager
            .ensureOwnFiles(span)
            .concat(rxjs_1.Observable.defer(() => {
            // Convert URI to file path because TypeScript doesn't work with URIs
            const fileName = util_1.uri2path(uri);
            // Get tsconfig configuration for requested file
            const configuration = this.projectManager.getConfiguration(fileName);
            // Ensure all files have been added
            configuration.ensureAllFiles(span);
            const program = configuration.getProgram(span);
            if (!program) {
                return rxjs_1.Observable.empty();
            }
            // Get SourceFile object for requested file
            const sourceFile = this._getSourceFile(configuration, fileName, span);
            if (!sourceFile) {
                throw new Error(`Source file ${fileName} does not exist`);
            }
            // Convert line/character to offset
            const offset = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            // Request references at position from TypeScript
            // Despite the signature, getReferencesAtPosition() can return undefined
            return rxjs_1.Observable.from(configuration.getService().getReferencesAtPosition(fileName, offset) || [])
                .filter(reference => 
            // Filter declaration if not requested
            (!reference.isDefinition ||
                (params.context && params.context.includeDeclaration)) &&
                // Filter references in node_modules
                !reference.fileName.includes('/node_modules/'))
                .map((reference) => {
                const sourceFile = program.getSourceFile(reference.fileName);
                if (!sourceFile) {
                    throw new Error(`Source file ${reference.fileName} does not exist`);
                }
                // Convert offset to line/character position
                const start = ts.getLineAndCharacterOfPosition(sourceFile, reference.textSpan.start);
                const end = ts.getLineAndCharacterOfPosition(sourceFile, reference.textSpan.start + reference.textSpan.length);
                return {
                    uri: util_1.path2uri(reference.fileName),
                    range: {
                        start,
                        end,
                    },
                };
            });
        }))
            .map((location) => ({ op: 'add', path: '/-', value: location }))
            // Initialize with array
            .startWith({ op: 'add', path: '', value: [] }));
    }
    /**
     * The workspace symbol request is sent from the client to the server to list project-wide
     * symbols matching the query string. The text document parameter specifies the active document
     * at time of the query. This can be used to rank or limit results.
     *
     * @return Observable of JSON Patches that build a `SymbolInformation[]` result
     */
    workspaceSymbol(params, span = new opentracing_1.Span()) {
        // Return cached result for empty query, if available
        if (!params.query && !params.symbol && this.emptyQueryWorkspaceSymbols) {
            return this.emptyQueryWorkspaceSymbols;
        }
        /** A sorted array that keeps track of symbol match scores to determine the index to insert the symbol at */
        const scores = [];
        let observable = this.isDefinitelyTyped
            .mergeMap((isDefinitelyTyped) => {
            // Use special logic for DefinitelyTyped
            // Search only in the correct subdirectory for the given PackageDescriptor
            if (isDefinitelyTyped) {
                // Error if not passed a SymbolDescriptor query with an `@types` PackageDescriptor
                if (!params.symbol ||
                    !params.symbol.package ||
                    !params.symbol.package.name ||
                    !params.symbol.package.name.startsWith('@types/')) {
                    return rxjs_1.Observable.throw(new Error('workspace/symbol on DefinitelyTyped is only supported with a SymbolDescriptor query with an @types PackageDescriptor'));
                }
                // Fetch all files in the package subdirectory
                // All packages are in the types/ subdirectory
                const normRootUri = this.rootUri.endsWith('/') ? this.rootUri : this.rootUri + '/';
                const packageRootUri = normRootUri + params.symbol.package.name.substr(1) + '/';
                return this.updater
                    .ensureStructure(span)
                    .concat(rxjs_1.Observable.defer(() => util_1.observableFromIterable(this.inMemoryFileSystem.uris())))
                    .filter(uri => uri.startsWith(packageRootUri))
                    .mergeMap(uri => this.updater.ensure(uri, span))
                    .concat(rxjs_1.Observable.defer(() => {
                    span.log({ event: 'fetched package files' });
                    const config = this.projectManager.getParentConfiguration(packageRootUri, 'ts');
                    if (!config) {
                        throw new Error(`Could not find tsconfig for ${packageRootUri}`);
                    }
                    // Don't match PackageDescriptor on symbols
                    return this._getSymbolsInConfig(config, lodash_1.omit(params.symbol, 'package'), span);
                }));
            }
            // Regular workspace symbol search
            // Search all symbols in own code, but not in dependencies
            return (this.projectManager
                .ensureOwnFiles(span)
                .concat(rxjs_1.Observable.defer(() => {
                if (params.symbol && params.symbol.package && params.symbol.package.name) {
                    // If SymbolDescriptor query with PackageDescriptor, search for package.jsons with matching package name
                    return (util_1.observableFromIterable(this.packageManager.packageJsonUris())
                        .filter(packageJsonUri => JSON.parse(this.inMemoryFileSystem.getContent(packageJsonUri)).name === params.symbol.package.name)
                        // Find their parent and child tsconfigs
                        .mergeMap(packageJsonUri => rxjs_1.Observable.merge(lodash_1.castArray(this.projectManager.getParentConfiguration(packageJsonUri) || []), 
                    // Search child directories starting at the directory of the package.json
                    util_1.observableFromIterable(this.projectManager.getChildConfigurations(url.resolve(packageJsonUri, '.'))))));
                }
                // Else search all tsconfigs in the workspace
                return util_1.observableFromIterable(this.projectManager.configurations());
            }))
                // If PackageDescriptor is given, only search project with the matching package name
                .mergeMap(config => this._getSymbolsInConfig(config, params.query || params.symbol, span)));
        })
            // Filter duplicate symbols
            // There may be few configurations that contain the same file(s)
            // or files from different configurations may refer to the same file(s)
            .distinct(symbol => hashObject(symbol, { respectType: false }))
            // Limit the total amount of symbols returned for text or empty queries
            // Higher limit for programmatic symbol queries because it could exclude results with a higher score
            .take(params.symbol ? 1000 : 100)
            // Find out at which index to insert the symbol to maintain sorting order by score
            .map(([score, symbol]) => {
            const index = scores.findIndex(s => s < score);
            if (index === -1) {
                scores.push(score);
                return { op: 'add', path: '/-', value: symbol };
            }
            scores.splice(index, 0, score);
            return { op: 'add', path: '/' + index, value: symbol };
        })
            .startWith({ op: 'add', path: '', value: [] });
        if (!params.query && !params.symbol) {
            observable = this.emptyQueryWorkspaceSymbols = observable.publishReplay().refCount();
        }
        return observable;
    }
    /**
     * The document symbol request is sent from the client to the server to list all symbols found
     * in a given text document.
     *
     * @return Observable of JSON Patches that build a `SymbolInformation[]` result
     */
    textDocumentDocumentSymbol(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Ensure files needed to resolve symbols are fetched
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .mergeMap(() => {
            const fileName = util_1.uri2path(uri);
            const config = this.projectManager.getConfiguration(fileName);
            config.ensureBasicFiles(span);
            const sourceFile = this._getSourceFile(config, fileName, span);
            if (!sourceFile) {
                return [];
            }
            const tree = config.getService().getNavigationTree(fileName);
            return util_1.observableFromIterable(symbols_1.walkNavigationTree(tree))
                .filter(({ tree, parent }) => symbols_1.navigationTreeIsSymbol(tree))
                .map(({ tree, parent }) => symbols_1.navigationTreeToSymbolInformation(tree, parent, sourceFile, this.root));
        })
            .map(symbol => ({ op: 'add', path: '/-', value: symbol }))
            .startWith({ op: 'add', path: '', value: [] });
    }
    /**
     * The workspace references request is sent from the client to the server to locate project-wide
     * references to a symbol given its description / metadata.
     *
     * @return Observable of JSON Patches that build a `ReferenceInformation[]` result
     */
    workspaceXreferences(params, span = new opentracing_1.Span()) {
        const queryWithoutPackage = lodash_1.omit(params.query, 'package');
        const minScore = Math.min(4.75, util_1.getPropertyCount(queryWithoutPackage));
        return this.isDefinitelyTyped
            .mergeMap(isDefinitelyTyped => {
            if (isDefinitelyTyped) {
                throw new Error('workspace/xreferences not supported in DefinitelyTyped');
            }
            return this.projectManager.ensureAllFiles(span);
        })
            .concat(rxjs_1.Observable.defer(() => {
            // if we were hinted that we should only search a specific package, find it and only search the owning tsconfig.json
            if (params.hints && params.hints.dependeePackageName) {
                return util_1.observableFromIterable(this.packageManager.packageJsonUris())
                    .filter(uri => JSON.parse(this.inMemoryFileSystem.getContent(uri)).name ===
                    params.hints.dependeePackageName)
                    .take(1)
                    .mergeMap(uri => {
                    const config = this.projectManager.getParentConfiguration(uri);
                    if (!config) {
                        return util_1.observableFromIterable(this.projectManager.configurations());
                    }
                    return [config];
                });
            }
            // else search all tsconfig.jsons
            return util_1.observableFromIterable(this.projectManager.configurations());
        }))
            .mergeMap((config) => {
            config.ensureAllFiles(span);
            const program = config.getProgram(span);
            if (!program) {
                return rxjs_1.Observable.empty();
            }
            return (rxjs_1.Observable.from(program.getSourceFiles())
                // Ignore dependency files
                .filter(source => !util_1.toUnixPath(source.fileName).includes('/node_modules/'))
                .mergeMap(source => 
            // Iterate AST of source file
            util_1.observableFromIterable(ast_1.walkMostAST(source))
                // Filter Identifier Nodes
                // TODO: include string-interpolated references
                .filter((node) => node.kind === ts.SyntaxKind.Identifier)
                .mergeMap(node => {
                try {
                    // Find definition for node
                    return rxjs_1.Observable.from(config
                        .getService()
                        .getDefinitionAtPosition(source.fileName, node.pos + 1) || [])
                        .mergeMap(definition => {
                        const symbol = symbols_1.definitionInfoToSymbolDescriptor(definition, this.root);
                        // Check if SymbolDescriptor without PackageDescriptor matches
                        const score = util_1.getMatchingPropertyCount(queryWithoutPackage, symbol);
                        if (score < minScore ||
                            (params.query.package &&
                                !definition.fileName.includes(params.query.package.name))) {
                            return [];
                        }
                        span.log({ event: 'match', score });
                        // If no PackageDescriptor query, return match
                        if (!params.query.package || !params.query.package) {
                            return [symbol];
                        }
                        // If SymbolDescriptor matched and the query contains a PackageDescriptor, get package.json and match PackageDescriptor name
                        // TODO match full PackageDescriptor (version) and fill out the symbol.package field
                        const uri = util_1.path2uri(definition.fileName);
                        return this._getPackageDescriptor(uri, span)
                            .defaultIfEmpty(undefined)
                            .filter(packageDescriptor => !!(packageDescriptor &&
                            packageDescriptor.name === params.query.package.name))
                            .map(packageDescriptor => {
                            symbol.package = packageDescriptor;
                            return symbol;
                        });
                    })
                        .map((symbol) => ({
                        symbol,
                        reference: {
                            uri: symbols_1.locationUri(source.fileName),
                            range: {
                                start: ts.getLineAndCharacterOfPosition(source, node.pos),
                                end: ts.getLineAndCharacterOfPosition(source, node.end),
                            },
                        },
                    }));
                }
                catch (err) {
                    // Continue with next node on error
                    // Workaround for https://github.com/Microsoft/TypeScript/issues/15219
                    this.logger.error(`workspace/xreferences: Error getting definition for ${source.fileName} at offset ${node.pos + 1}`, err);
                    span.log({
                        event: 'error',
                        'error.object': err,
                        message: err.message,
                        stack: err.stack,
                    });
                    return [];
                }
            })));
        })
            .map((reference) => ({ op: 'add', path: '/-', value: reference }))
            .startWith({ op: 'add', path: '', value: [] });
    }
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
    workspaceXpackages(params = {}, span = new opentracing_1.Span()) {
        return this.isDefinitelyTyped
            .mergeMap((isDefinitelyTyped) => {
            // In DefinitelyTyped, report all @types/ packages
            if (isDefinitelyTyped) {
                const typesUri = url.resolve(this.rootUri, 'types/');
                return (util_1.observableFromIterable(this.inMemoryFileSystem.uris())
                    // Find all types/ subdirectories
                    .filter(uri => uri.startsWith(typesUri))
                    // Get the directory names
                    .map((uri) => ({
                    package: {
                        name: '@types/' + decodeURIComponent(uri.substr(typesUri.length).split('/')[0]),
                    },
                    // TODO parse /// <reference types="node" /> comments in .d.ts files for collecting dependencies between @types packages
                    dependencies: [],
                })));
            }
            // For other workspaces, search all package.json files
            return (this.projectManager
                .ensureModuleStructure(span)
                // Iterate all files
                .concat(rxjs_1.Observable.defer(() => util_1.observableFromIterable(this.inMemoryFileSystem.uris())))
                // Filter own package.jsons
                .filter(uri => uri.includes('/package.json') && !uri.includes('/node_modules/'))
                // Map to contents of package.jsons
                .mergeMap(uri => this.packageManager.getPackageJson(uri))
                // Map each package.json to a PackageInformation
                .mergeMap(packageJson => {
                if (!packageJson.name) {
                    return [];
                }
                const packageDescriptor = {
                    name: packageJson.name,
                    version: packageJson.version,
                    repoURL: (typeof packageJson.repository === 'object' && packageJson.repository.url) ||
                        undefined,
                };
                // Collect all dependencies for this package.json
                return (rxjs_1.Observable.from(packages_1.DEPENDENCY_KEYS)
                    .filter(key => !!packageJson[key])
                    // Get [name, version] pairs
                    .mergeMap(key => lodash_2.toPairs(packageJson[key]))
                    // Map to DependencyReferences
                    .map(([name, version]) => ({
                    attributes: {
                        name,
                        version,
                    },
                    hints: {
                        dependeePackageName: packageJson.name,
                    },
                }))
                    .toArray()
                    .map((dependencies) => ({
                    package: packageDescriptor,
                    dependencies,
                })));
            }));
        })
            .map((packageInfo) => ({ op: 'add', path: '/-', value: packageInfo }))
            .startWith({ op: 'add', path: '', value: [] });
    }
    /**
     * Returns all dependencies of a workspace.
     * Superseded by workspace/xpackages
     *
     * @return Observable of JSON Patches that build a `DependencyReference[]` result
     */
    workspaceXdependencies(params = {}, span = new opentracing_1.Span()) {
        // Ensure package.json files
        return (this.projectManager
            .ensureModuleStructure()
            // Iterate all files
            .concat(rxjs_1.Observable.defer(() => util_1.observableFromIterable(this.inMemoryFileSystem.uris())))
            // Filter own package.jsons
            .filter(uri => uri.includes('/package.json') && !uri.includes('/node_modules/'))
            // Ensure contents of own package.jsons
            .mergeMap(uri => this.packageManager.getPackageJson(uri))
            // Map package.json to DependencyReferences
            .mergeMap(packageJson => rxjs_1.Observable.from(packages_1.DEPENDENCY_KEYS)
            .filter(key => !!packageJson[key])
            // Get [name, version] pairs
            .mergeMap(key => lodash_2.toPairs(packageJson[key]))
            .map(([name, version]) => ({
            attributes: {
                name,
                version,
            },
            hints: {
                dependeePackageName: packageJson.name,
            },
        })))
            .map((dependency) => ({ op: 'add', path: '/-', value: dependency }))
            .startWith({ op: 'add', path: '', value: [] }));
    }
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
    textDocumentCompletion(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Ensure files needed to suggest completions are fetched
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .mergeMap(() => {
            const fileName = util_1.uri2path(uri);
            const configuration = this.projectManager.getConfiguration(fileName);
            configuration.ensureBasicFiles(span);
            const sourceFile = this._getSourceFile(configuration, fileName, span);
            if (!sourceFile) {
                return [];
            }
            const offset = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            const completions = configuration.getService().getCompletionsAtPosition(fileName, offset, undefined);
            if (!completions) {
                return [];
            }
            return rxjs_1.Observable.from(completions.entries)
                .map(entry => {
                const item = { label: entry.name };
                const kind = completionKinds.get(entry.kind);
                if (kind) {
                    item.kind = kind;
                }
                if (entry.sortText) {
                    item.sortText = entry.sortText;
                }
                // context for future resolve requests:
                item.data = {
                    uri,
                    offset,
                    entryName: entry.name,
                };
                return { op: 'add', path: '/items/-', value: item };
            })
                .startWith({ op: 'add', path: '/isIncomplete', value: false });
        })
            .startWith({ op: 'add', path: '', value: { isIncomplete: true, items: [] } });
    }
    /**
     * The completionItem/resolve request is used to fill in additional details from an incomplete
     * CompletionItem returned from the textDocument/completions call.
     *
     * @return Observable of JSON Patches that build a `CompletionItem` result
     */
    completionItemResolve(item, span = new opentracing_1.Span()) {
        if (!item.data) {
            throw new Error('Cannot resolve completion item without data');
        }
        const { uri, offset, entryName } = item.data;
        const fileName = util_1.uri2path(uri);
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .map(() => {
            const configuration = this.projectManager.getConfiguration(fileName);
            configuration.ensureBasicFiles(span);
            const details = configuration
                .getService()
                .getCompletionEntryDetails(fileName, offset, entryName, undefined, undefined);
            if (details) {
                item.documentation = ts.displayPartsToString(details.documentation);
                item.detail = ts.displayPartsToString(details.displayParts);
                if (this.supportsCompletionWithSnippets &&
                    (details.kind === 'method' || details.kind === 'function')) {
                    const parameters = details.displayParts
                        .filter(p => p.kind === 'parameterName')
                        // tslint:disable-next-line:no-invalid-template-strings
                        .map((p, i) => '${' + `${i + 1}:${p.text}` + '}');
                    const paramString = parameters.join(', ');
                    item.insertText = details.name + `(${paramString})`;
                    item.insertTextFormat = vscode_languageserver_1.InsertTextFormat.Snippet;
                }
                else {
                    item.insertTextFormat = vscode_languageserver_1.InsertTextFormat.PlainText;
                    item.insertText = details.name;
                }
                item.data = undefined;
            }
            return item;
        })
            .map(completionItem => ({ op: 'add', path: '', value: completionItem }));
    }
    /**
     * The signature help request is sent from the client to the server to request signature
     * information at a given cursor position.
     *
     * @return Observable of JSON Patches that build a `SignatureHelp` result
     */
    textDocumentSignatureHelp(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        // Ensure files needed to resolve signature are fetched
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .map(() => {
            const filePath = util_1.uri2path(uri);
            const configuration = this.projectManager.getConfiguration(filePath);
            configuration.ensureBasicFiles(span);
            const sourceFile = this._getSourceFile(configuration, filePath, span);
            if (!sourceFile) {
                throw new Error(`expected source file ${filePath} to exist in configuration`);
            }
            const offset = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            const signatures = configuration
                .getService()
                .getSignatureHelpItems(filePath, offset);
            if (!signatures) {
                return { signatures: [], activeParameter: 0, activeSignature: 0 };
            }
            const signatureInformations = signatures.items.map((item) => {
                const prefix = ts.displayPartsToString(item.prefixDisplayParts);
                const params = item.parameters.map(p => ts.displayPartsToString(p.displayParts)).join(', ');
                const suffix = ts.displayPartsToString(item.suffixDisplayParts);
                const parameters = item.parameters.map((p) => ({
                    label: ts.displayPartsToString(p.displayParts),
                    documentation: ts.displayPartsToString(p.documentation),
                }));
                return {
                    label: prefix + params + suffix,
                    documentation: ts.displayPartsToString(item.documentation),
                    parameters,
                };
            });
            return {
                signatures: signatureInformations,
                activeSignature: signatures.selectedItemIndex,
                activeParameter: signatures.argumentIndex,
            };
        })
            .map(signatureHelp => ({ op: 'add', path: '', value: signatureHelp }));
    }
    /**
     * The code action request is sent from the client to the server to compute commands for a given
     * text document and range. These commands are typically code fixes to either fix problems or to
     * beautify/refactor code.
     *
     * @return Observable of JSON Patches that build a `Command[]` result
     */
    textDocumentCodeAction(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        return this.projectManager
            .ensureReferencedFiles(uri, undefined, undefined, span)
            .toArray()
            .mergeMap(() => {
            const configuration = this.projectManager.getParentConfiguration(uri);
            if (!configuration) {
                throw new Error(`Could not find tsconfig for ${uri}`);
            }
            configuration.ensureBasicFiles(span);
            const filePath = util_1.uri2path(uri);
            const sourceFile = this._getSourceFile(configuration, filePath, span);
            if (!sourceFile) {
                throw new Error(`Expected source file ${filePath} to exist in configuration`);
            }
            const start = ts.getPositionOfLineAndCharacter(sourceFile, params.range.start.line, params.range.start.character);
            const end = ts.getPositionOfLineAndCharacter(sourceFile, params.range.end.line, params.range.end.character);
            const errorCodes = iterare_1.default(params.context.diagnostics)
                .map(diagnostic => diagnostic.code)
                .filter(code => typeof code === 'number')
                .toArray();
            return (configuration
                .getService()
                .getCodeFixesAtPosition(filePath, start, end, errorCodes, this.settings.format || {}) || []);
        })
            .map((action) => ({
            op: 'add',
            path: '/-',
            value: {
                title: action.description,
                command: 'codeFix',
                arguments: action.changes,
            },
        }))
            .startWith({ op: 'add', path: '', value: [] });
    }
    /**
     * The workspace/executeCommand request is sent from the client to the server to trigger command
     * execution on the server. In most cases the server creates a WorkspaceEdit structure and
     * applies the changes to the workspace using the request workspace/applyEdit which is sent from
     * the server to the client.
     */
    workspaceExecuteCommand(params, span = new opentracing_1.Span()) {
        switch (params.command) {
            case 'codeFix':
                if (!params.arguments || params.arguments.length < 1) {
                    return rxjs_1.Observable.throw(new Error(`Command ${params.command} requires arguments`));
                }
                return this.executeCodeFixCommand(params.arguments, span);
            default:
                return rxjs_1.Observable.throw(new Error(`Unknown command ${params.command}`));
        }
    }
    /**
     * Executes the `codeFix` command
     *
     * @return Observable of JSON Patches for `null` result
     */
    executeCodeFixCommand(fileTextChanges, span = new opentracing_1.Span()) {
        if (fileTextChanges.length === 0) {
            return rxjs_1.Observable.throw(new Error('No changes supplied for code fix command'));
        }
        return this.projectManager
            .ensureOwnFiles(span)
            .concat(rxjs_1.Observable.defer(() => {
            // Configuration lookup uses Windows paths, FileTextChanges uses unix paths. Convert to backslashes.
            const unixFilePath = fileTextChanges[0].fileName;
            const firstChangedFile = /^[a-z]:\//i.test(unixFilePath)
                ? unixFilePath.replace(/\//g, '\\')
                : unixFilePath;
            const configuration = this.projectManager.getConfiguration(firstChangedFile);
            configuration.ensureBasicFiles(span);
            const changes = {};
            for (const change of fileTextChanges) {
                const sourceFile = this._getSourceFile(configuration, change.fileName, span);
                if (!sourceFile) {
                    throw new Error(`Expected source file ${change.fileName} to exist in configuration`);
                }
                const uri = util_1.path2uri(change.fileName);
                changes[uri] = change.textChanges.map(({ span, newText }) => ({
                    range: {
                        start: ts.getLineAndCharacterOfPosition(sourceFile, span.start),
                        end: ts.getLineAndCharacterOfPosition(sourceFile, span.start + span.length),
                    },
                    newText,
                }));
            }
            return this.client.workspaceApplyEdit({ edit: { changes } }, span);
        }))
            .map(() => ({ op: 'add', path: '', value: null }));
    }
    /**
     * The rename request is sent from the client to the server to perform a workspace-wide rename of a symbol.
     *
     * @return Observable of JSON Patches that build a `WorkspaceEdit` result
     */
    textDocumentRename(params, span = new opentracing_1.Span()) {
        const uri = util_1.normalizeUri(params.textDocument.uri);
        const editUris = new Set();
        return this.projectManager
            .ensureOwnFiles(span)
            .concat(rxjs_1.Observable.defer(() => {
            const filePath = util_1.uri2path(uri);
            const configuration = this.projectManager.getParentConfiguration(params.textDocument.uri);
            if (!configuration) {
                throw new Error(`tsconfig.json not found for ${filePath}`);
            }
            configuration.ensureAllFiles(span);
            const sourceFile = this._getSourceFile(configuration, filePath, span);
            if (!sourceFile) {
                throw new Error(`Expected source file ${filePath} to exist in configuration`);
            }
            const position = ts.getPositionOfLineAndCharacter(sourceFile, params.position.line, params.position.character);
            const renameInfo = configuration.getService().getRenameInfo(filePath, position);
            if (!renameInfo.canRename) {
                throw new Error('This symbol cannot be renamed');
            }
            return rxjs_1.Observable.from(configuration.getService().findRenameLocations(filePath, position, false, true)).map((location) => {
                const sourceFile = this._getSourceFile(configuration, location.fileName, span);
                if (!sourceFile) {
                    throw new Error(`expected source file ${location.fileName} to exist in configuration`);
                }
                const editUri = util_1.path2uri(location.fileName);
                const start = ts.getLineAndCharacterOfPosition(sourceFile, location.textSpan.start);
                const end = ts.getLineAndCharacterOfPosition(sourceFile, location.textSpan.start + location.textSpan.length);
                const edit = { range: { start, end }, newText: params.newName };
                return [editUri, edit];
            });
        }))
            .map(([uri, edit]) => {
            // if file has no edit yet, initialize array
            if (!editUris.has(uri)) {
                editUris.add(uri);
                return { op: 'add', path: util_1.JSONPTR `/changes/${uri}`, value: [edit] };
            }
            // else append to array
            return { op: 'add', path: util_1.JSONPTR `/changes/${uri}/-`, value: edit };
        })
            .startWith({ op: 'add', path: '', value: { changes: {} } });
    }
    /**
     * The initialized notification is sent from the client to the server after the client received
     * the result of the initialize request but before the client is sending any other request or
     * notification to the server. The server can use the initialized notification for example to
     * dynamically register capabilities.
     */
    initialized() {
        return __awaiter(this, void 0, void 0, function* () {
            // nop
        });
    }
    /**
     * The document open notification is sent from the client to the server to signal newly opened
     * text documents. The document's truth is now managed by the client and the server must not try
     * to read the document's truth using the document's uri.
     */
    textDocumentDidOpen(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = util_1.normalizeUri(params.textDocument.uri);
            // Ensure files needed for most operations are fetched
            yield this.projectManager.ensureReferencedFiles(uri).toPromise();
            this.projectManager.didOpen(uri, params.textDocument.text);
            yield new Promise(resolve => setTimeout(resolve, 200));
            this._publishDiagnostics(uri);
        });
    }
    /**
     * The document change notification is sent from the client to the server to signal changes to a
     * text document. In 2.0 the shape of the params has changed to include proper version numbers
     * and language ids.
     */
    textDocumentDidChange(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = util_1.normalizeUri(params.textDocument.uri);
            let text;
            for (const change of params.contentChanges) {
                if (change.range || change.rangeLength) {
                    throw new Error('incremental updates in textDocument/didChange not supported for file ' + uri);
                }
                text = change.text;
            }
            if (!text) {
                return;
            }
            this.projectManager.didChange(uri, text);
            yield new Promise(resolve => setTimeout(resolve, 200));
            this._publishDiagnostics(uri);
        });
    }
    /**
     * Generates and publishes diagnostics for a given file
     *
     * @param uri URI of the file to check
     */
    _publishDiagnostics(uri, span = new opentracing_1.Span()) {
        const config = this.projectManager.getParentConfiguration(uri);
        if (!config) {
            return;
        }
        const fileName = util_1.uri2path(uri);
        const tsDiagnostics = config
            .getService()
            .getSyntacticDiagnostics(fileName)
            .concat(config.getService().getSemanticDiagnostics(fileName));
        const diagnostics = iterare_1.default(tsDiagnostics)
            // TS can report diagnostics without a file and range in some cases
            // These cannot be represented as LSP Diagnostics since the range and URI is required
            // https://github.com/Microsoft/TypeScript/issues/15666
            .filter(diagnostic => !!diagnostic.file)
            .map(diagnostics_1.convertTsDiagnostic)
            .toArray();
        this.client.textDocumentPublishDiagnostics({ uri, diagnostics });
    }
    /**
     * The document save notification is sent from the client to the server when the document was
     * saved in the client.
     */
    textDocumentDidSave(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = util_1.normalizeUri(params.textDocument.uri);
            // Ensure files needed to suggest completions are fetched
            yield this.projectManager.ensureReferencedFiles(uri).toPromise();
            this.projectManager.didSave(uri);
        });
    }
    /**
     * The document close notification is sent from the client to the server when the document got
     * closed in the client. The document's truth now exists where the document's uri points to
     * (e.g. if the document's uri is a file uri the truth now exists on disk).
     */
    textDocumentDidClose(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = util_1.normalizeUri(params.textDocument.uri);
            // Ensure files needed to suggest completions are fetched
            yield this.projectManager.ensureReferencedFiles(uri).toPromise();
            this.projectManager.didClose(uri);
            // Clear diagnostics
            this.client.textDocumentPublishDiagnostics({ uri, diagnostics: [] });
        });
    }
    /**
     * Fetches (or creates if needed) source file object for a given file name
     *
     * @param configuration project configuration
     * @param fileName file name to fetch source file for or create it
     * @param span Span for tracing
     */
    _getSourceFile(configuration, fileName, span = new opentracing_1.Span()) {
        let program = configuration.getProgram(span);
        if (!program) {
            return undefined;
        }
        const sourceFile = program.getSourceFile(fileName);
        if (sourceFile) {
            return sourceFile;
        }
        if (!this.projectManager.hasFile(fileName)) {
            return undefined;
        }
        configuration.getHost().addFile(fileName);
        program = configuration.getProgram(span);
        return program && program.getSourceFile(fileName);
    }
    /**
     * Returns an Observable for all symbols in a given config that match a given SymbolDescriptor or text query
     *
     * @param config The ProjectConfiguration to search
     * @param query A text or SymbolDescriptor query
     * @return Observable of [match score, SymbolInformation]
     */
    _getSymbolsInConfig(config, query, childOf = new opentracing_1.Span()) {
        return tracing_1.traceObservable('Get symbols in config', childOf, span => {
            span.addTags({ config: config.configFilePath, query });
            config.ensureAllFiles(span);
            const program = config.getProgram(span);
            if (!program) {
                return rxjs_1.Observable.empty();
            }
            if (typeof query === 'string') {
                // Query by text query
                // Limit the amount of symbols searched for text queries
                return (rxjs_1.Observable.from(config.getService().getNavigateToItems(query, 100, undefined, false))
                    // Exclude dependencies and standard library
                    .filter(item => !memfs_1.isTypeScriptLibrary(item.fileName) && !item.fileName.includes('/node_modules/'))
                    // Same score for all
                    .map(item => [1, symbols_1.navigateToItemToSymbolInformation(item, program, this.root)]));
            }
            else {
                const queryWithoutPackage = query && lodash_1.omit(query, 'package');
                // Require at least 2 properties to match (or all if less provided)
                const minScore = Math.min(2, util_1.getPropertyCount(query));
                const minScoreWithoutPackage = Math.min(2, util_1.getPropertyCount(queryWithoutPackage));
                const service = config.getService();
                return (rxjs_1.Observable.from(program.getSourceFiles())
                    // Exclude dependencies and standard library
                    .filter(sourceFile => !memfs_1.isTypeScriptLibrary(sourceFile.fileName) &&
                    !sourceFile.fileName.includes('/node_modules/'))
                    .mergeMap(sourceFile => {
                    try {
                        const tree = service.getNavigationTree(sourceFile.fileName);
                        const nodes = util_1.observableFromIterable(symbols_1.walkNavigationTree(tree)).filter(({ tree, parent }) => symbols_1.navigationTreeIsSymbol(tree));
                        let matchedNodes;
                        if (!query) {
                            matchedNodes = nodes.map(({ tree, parent }) => ({ score: 1, tree, parent }));
                        }
                        else {
                            matchedNodes = nodes
                                // Get a score how good the symbol matches the SymbolDescriptor (ignoring PackageDescriptor)
                                .map(({ tree, parent }) => {
                                const symbolDescriptor = symbols_1.navigationTreeToSymbolDescriptor(tree, parent, sourceFile.fileName, this.root);
                                const score = util_1.getMatchingPropertyCount(queryWithoutPackage, symbolDescriptor);
                                return { score, tree, parent };
                            })
                                // Require the minimum score without the PackageDescriptor name
                                .filter(({ score }) => score >= minScoreWithoutPackage)
                                // If SymbolDescriptor matched, get package.json and match PackageDescriptor name
                                // TODO get and match full PackageDescriptor (version)
                                .mergeMap(({ score, tree, parent }) => {
                                if (!query.package || !query.package.name) {
                                    return [{ score, tree, parent }];
                                }
                                const uri = util_1.path2uri(sourceFile.fileName);
                                return (this.packageManager
                                    .getClosestPackageJson(uri, span)
                                    // If PackageDescriptor matches, increase score
                                    .defaultIfEmpty(undefined)
                                    .map(packageJson => {
                                    if (packageJson && packageJson.name === query.package.name) {
                                        score++;
                                    }
                                    return { score, tree, parent };
                                }));
                            })
                                // Require a minimum score to not return thousands of results
                                .filter(({ score }) => score >= minScore);
                        }
                        return matchedNodes.map(({ score, tree, parent }) => [
                            score,
                            symbols_1.navigationTreeToSymbolInformation(tree, parent, sourceFile, this.root),
                        ]);
                    }
                    catch (e) {
                        this.logger.error('Could not get navigation tree for file', sourceFile.fileName);
                        return [];
                    }
                }));
            }
        });
    }
}
exports.TypeScriptService = TypeScriptService;
//# sourceMappingURL=typescript-service.js.map