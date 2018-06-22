/// <reference types="node" />
import { EventEmitter } from 'events';
import * as ts from 'typescript';
import { Logger } from './logging';
import { FileSystemEntries } from './match-files';
/**
 * TypeScript library files fetched from the local file system (bundled TS)
 */
export declare const typeScriptLibraries: Map<string, string>;
/**
 * In-memory file cache node which represents either a folder or a file
 */
export interface FileSystemNode {
    file: boolean;
    children: Map<string, FileSystemNode>;
}
/**
 * In-memory file system, can be served as a ParseConfigHost (thus allowing listing files that belong to project based on tsconfig.json options)
 */
export declare class InMemoryFileSystem extends EventEmitter implements ts.ParseConfigHost, ts.ModuleResolutionHost {
    private logger;
    /**
     * Contains a Map of all URIs that exist in the workspace, optionally with a content.
     * File contents for URIs in it do not neccessarily have to be fetched already.
     */
    private files;
    /**
     * Map (URI -> string content) of temporary files made while user modifies local file(s)
     */
    overlay: Map<string, string>;
    /**
     * Should we take into account register when performing a file name match or not. On Windows when using local file system, file names are case-insensitive
     */
    useCaseSensitiveFileNames: boolean;
    /**
     * Root path
     */
    path: string;
    /**
     * File tree root
     */
    rootNode: FileSystemNode;
    constructor(path: string, logger?: Logger);
    /** Emitted when a file was added */
    on(event: 'add', listener: (uri: string, content?: string) => void): this;
    /**
     * Returns an IterableIterator for all URIs known to exist in the workspace (content loaded or not)
     */
    uris(): IterableIterator<string>;
    /**
     * Adds a file to the local cache
     *
     * @param uri The URI of the file
     * @param content The optional content
     */
    add(uri: string, content?: string): void;
    /**
     * Returns true if the given file is known to exist in the workspace (content loaded or not)
     *
     * @param uri URI to a file
     */
    has(uri: string): boolean;
    /**
     * Returns the file content for the given URI.
     * Will throw an Error if no available in-memory.
     * Use FileSystemUpdater.ensure() to ensure that the file is available.
     */
    getContent(uri: string): string;
    /**
     * Tells if a file denoted by the given name exists in the workspace (does not have to be loaded)
     *
     * @param path File path or URI (both absolute or relative file paths are accepted)
     */
    fileExists(path: string): boolean;
    /**
     * @param path file path (both absolute or relative file paths are accepted)
     * @return file's content in the following order (overlay then cache).
     * If there is no such file, returns empty string to match expected signature
     */
    readFile(path: string): string;
    /**
     * @param path file path (both absolute or relative file paths are accepted)
     * @return file's content in the following order (overlay then cache).
     * If there is no such file, returns undefined
     */
    private readFileIfExists(path);
    /**
     * Invalidates temporary content denoted by the given URI
     * @param uri file's URI
     */
    didClose(uri: string): void;
    /**
     * Adds temporary content denoted by the given URI
     * @param uri file's URI
     */
    didSave(uri: string): void;
    /**
     * Updates temporary content denoted by the given URI
     * @param uri file's URI
     */
    didChange(uri: string, text: string): void;
    /**
     * Called by TS service to scan virtual directory when TS service looks for source files that belong to a project
     */
    readDirectory(rootDir: string, extensions: string[], excludes: string[], includes: string[]): string[];
    /**
     * Called by TS service to scan virtual directory when TS service looks for source files that belong to a project
     */
    getFileSystemEntries(path: string): FileSystemEntries;
    trace(message: string): void;
}
/**
 * @param path file path
 * @return true if given file belongs to bundled TypeScript libraries
 */
export declare function isTypeScriptLibrary(path: string): boolean;
