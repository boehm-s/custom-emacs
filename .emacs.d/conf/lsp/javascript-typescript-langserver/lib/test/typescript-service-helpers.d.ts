/// <reference types="sinon" />
/// <reference types="mocha" />
import { IBeforeAndAfterContext } from 'mocha';
import * as sinon from 'sinon';
import { LanguageClient } from '../lang-handler';
import { ClientCapabilities } from '../request-type';
import { TypeScriptService, TypeScriptServiceFactory } from '../typescript-service';
export interface TestContext {
    /** TypeScript service under test */
    service: TypeScriptService;
    /** Stubbed LanguageClient */
    client: {
        [K in keyof LanguageClient]: LanguageClient[K] & sinon.SinonStub;
    };
}
/**
 * Returns a function that initializes the test context with a TypeScriptService instance and initializes it (to be used in `beforeEach`)
 *
 * @param createService A factory that creates the TypeScript service. Allows to test subclasses of TypeScriptService
 * @param files A Map from URI to file content of files that should be available in the workspace
 */
export declare const initializeTypeScriptService: (createService: TypeScriptServiceFactory, rootUri: string, files: Map<string, string>, clientCapabilities?: ClientCapabilities) => (this: TestContext & IBeforeAndAfterContext) => Promise<void>;
/**
 * Shuts the TypeScriptService down (to be used in `afterEach()`)
 */
export declare function shutdownTypeScriptService(this: TestContext & IBeforeAndAfterContext): Promise<void>;
/**
 * Describe a TypeScriptService class
 *
 * @param createService Factory function to create the TypeScriptService instance to describe
 */
export declare function describeTypeScriptService(createService: TypeScriptServiceFactory, shutdownService: typeof shutdownTypeScriptService | undefined, rootUri: string): void;
