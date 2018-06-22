import { Span } from 'opentracing';
import { Observable } from 'rxjs';
import { ApplyWorkspaceEditParams, ApplyWorkspaceEditResponse, LogMessageParams, PublishDiagnosticsParams, TextDocumentIdentifier, TextDocumentItem } from 'vscode-languageserver';
import { MessageEmitter, MessageWriter } from './connection';
import { CacheGetParams, CacheSetParams, TextDocumentContentParams, WorkspaceFilesParams } from './request-type';
export interface LanguageClient {
    /**
     * The content request is sent from the server to the client to request the current content of
     * any text document. This allows language servers to operate without accessing the file system
     * directly.
     */
    textDocumentXcontent(params: TextDocumentContentParams, childOf?: Span): Observable<TextDocumentItem>;
    /**
     * The files request is sent from the server to the client to request a list of all files in the
     * workspace or inside the directory of the `base` parameter, if given.
     */
    workspaceXfiles(params: WorkspaceFilesParams, childOf?: Span): Observable<TextDocumentIdentifier[]>;
    /**
     * The log message notification is sent from the server to the client to ask
     * the client to log a particular message.
     */
    windowLogMessage(params: LogMessageParams): void;
    /**
     * The cache get request is sent from the server to the client to request the value of a cache
     * item identified by the provided key.
     */
    xcacheGet(params: CacheGetParams, childOf?: Span): Observable<any>;
    /**
     * The cache set notification is sent from the server to the client to set the value of a cache
     * item identified by the provided key. This is a intentionally notification and not a request
     * because the server is not supposed to act differently if the cache set failed.
     */
    xcacheSet(params: CacheSetParams): void;
    /**
     * Diagnostics are sent from the server to the client to notify the user of errors/warnings
     * in a source file
     * @param params The diagnostics to send to the client
     */
    textDocumentPublishDiagnostics(params: PublishDiagnosticsParams): void;
    /**
     * Requests a set of text changes to be applied to documents in the workspace
     * Can occur as as a result of rename or executeCommand (code action).
     * @param params The edits to apply to the workspace
     */
    workspaceApplyEdit(params: ApplyWorkspaceEditParams, childOf?: Span): Observable<ApplyWorkspaceEditResponse>;
}
/**
 * Provides an interface to call methods on the remote client.
 * Methods are named after the camelCase version of the LSP method name
 */
export declare class RemoteLanguageClient {
    private input;
    private output;
    /** The next request ID to use */
    private idCounter;
    /**
     * @param input MessageEmitter to listen on for responses
     * @param output MessageWriter to write requests/notifications to
     */
    constructor(input: MessageEmitter, output: MessageWriter);
    /**
     * Sends a Request
     *
     * @param method The method to call
     * @param params The params to pass to the method
     * @return Emits the value of the result field or the error
     */
    private request(method, params, childOf?);
    /**
     * Sends a Notification
     *
     * @param method The method to notify
     * @param params The params to pass to the method
     */
    private notify(method, params);
    /**
     * The content request is sent from the server to the client to request the current content of
     * any text document. This allows language servers to operate without accessing the file system
     * directly.
     */
    textDocumentXcontent(params: TextDocumentContentParams, childOf?: Span): Observable<TextDocumentItem>;
    /**
     * The files request is sent from the server to the client to request a list of all files in the
     * workspace or inside the directory of the `base` parameter, if given.
     */
    workspaceXfiles(params: WorkspaceFilesParams, childOf?: Span): Observable<TextDocumentIdentifier[]>;
    /**
     * The log message notification is sent from the server to the client to ask
     * the client to log a particular message.
     */
    windowLogMessage(params: LogMessageParams): void;
    /**
     * The cache get request is sent from the server to the client to request the value of a cache
     * item identified by the provided key.
     */
    xcacheGet(params: CacheGetParams, childOf?: Span): Observable<any>;
    /**
     * The cache set notification is sent from the server to the client to set the value of a cache
     * item identified by the provided key. This is a intentionally notification and not a request
     * because the server is not supposed to act differently if the cache set failed.
     */
    xcacheSet(params: CacheSetParams): void;
    /**
     * Diagnostics are sent from the server to the client to notify the user of errors/warnings
     * in a source file
     * @param params The diagnostics to send to the client
     */
    textDocumentPublishDiagnostics(params: PublishDiagnosticsParams): void;
    /**
     * The workspace/applyEdit request is sent from the server to the client to modify resource on
     * the client side.
     *
     * @param params The edits to apply.
     */
    workspaceApplyEdit(params: ApplyWorkspaceEditParams, childOf?: Span): Observable<ApplyWorkspaceEditResponse>;
}
