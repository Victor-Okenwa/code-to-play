/**
 * CodeTracker.test.ts
 * 
 * Unit tests for CodeTracker class
 * Tests code change detection, meaningful line counting, and language-specific logic
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { resolveTrackedExtension, TRACKEDEXTENSION } from '../constants/TrackedExtensions';
import { CodeTracker } from '../core/CodeTracker';
import { StorageManager } from '../core/StorageManager';
import { DEFAULT_CONFIG } from '../core/types';

// Use mock context from StorageManager tests
class MockMemento implements vscode.Memento {
    private storage = new Map<string, any>();

    keys(): readonly string[] {
        return Array.from(this.storage.keys());
    }

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.storage.get(key) ?? defaultValue;
    }

    async update(key: string, value: any): Promise<void> {
        if (value === undefined) {
            this.storage.delete(key);
        } else {
            this.storage.set(key, value);
        }
    }
}

class MockExtensionContext implements vscode.ExtensionContext {
    subscriptions: vscode.Disposable[] = [];
    workspaceState: vscode.Memento;
    globalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void };
    secrets: vscode.SecretStorage = {} as any;
    extensionUri: vscode.Uri = vscode.Uri.file('/test');
    extensionPath: string = '/test';
    environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection = {} as any;
    asAbsolutePath(relativePath: string): string {
        return `/test/${relativePath}`;
    }
    storageUri: vscode.Uri | undefined = vscode.Uri.file('/test/storage');
    storagePath: string | undefined = '/test/storage';
    globalStorageUri: vscode.Uri = vscode.Uri.file('/test/global');
    globalStoragePath: string = '/test/global';
    logUri: vscode.Uri = vscode.Uri.file('/test/log');
    logPath: string = '/test/log';
    extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
    extension: vscode.Extension<any> = {} as any;
    languageModelAccessInformation: vscode.LanguageModelAccessInformation = {} as any;

    constructor() {
        const memento = new MockMemento();
        this.workspaceState = memento;
        this.globalState = Object.assign(memento, {
            setKeysForSync: (keys: readonly string[]) => { }
        });
    }
}

suite('CodeTracker Test Suite', () => {
    let codeTracker: CodeTracker;
    let storageManager: StorageManager;
    let context: MockExtensionContext;

    // Setup before each test
    setup(() => {
        context = new MockExtensionContext();
        storageManager = new StorageManager(context);
        codeTracker = new CodeTracker(storageManager);
    });

    // Cleanup after each test
    teardown(() => {
        codeTracker.dispose();
    });

    // ========================================
    // MEANINGFUL LINE DETECTION TESTS
    // ========================================

    test('Empty lines are not meaningful', () => {
        // Access private method through type assertion for testing
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('', 'typescript'), false);
        assert.strictEqual(isLineMeaningful('   ', 'typescript'), false);
    });

    test('Single character braces are not meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('{', 'typescript'), false);
        assert.strictEqual(isLineMeaningful('}', 'typescript'), false);
        assert.strictEqual(isLineMeaningful('(', 'typescript'), false);
        assert.strictEqual(isLineMeaningful(')', 'typescript'), false);
        assert.strictEqual(isLineMeaningful(';', 'typescript'), false);
    });

    test('JavaScript single-line comments are not meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('// This is a comment', 'javascript'), false);
        assert.strictEqual(isLineMeaningful('// TODO: Fix this', 'typescript'), false);
    });

    test('JavaScript multi-line comment markers are not meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('/* Comment start', 'javascript'), false);
        assert.strictEqual(isLineMeaningful('* Comment line', 'javascript'), false);
    });

    test('Python comments are not meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('# This is a comment', 'python'), false);
        assert.strictEqual(isLineMeaningful('# TODO: Implement', 'python'), false);
    });

    test('HTML comments are not meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('<!-- Comment -->', 'html'), false);
        assert.strictEqual(isLineMeaningful('<!-- TODO -->', 'xml'), false);
    });

    test('CSS comments are not meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('/* Style comment */', 'css'), false);
        assert.strictEqual(isLineMeaningful('/* colors */', 'scss'), false);
    });

    test('Actual code is meaningful', () => {
        const isLineMeaningful = (codeTracker as any).isLineMeaningful.bind(codeTracker);

        assert.strictEqual(isLineMeaningful('const x = 5;', 'typescript'), true);
        assert.strictEqual(isLineMeaningful('function test() {', 'javascript'), true);
        assert.strictEqual(isLineMeaningful('if (condition) {', 'typescript'), true);
        assert.strictEqual(isLineMeaningful('return result;', 'javascript'), true);
    });

    // ========================================
    // LINE COUNTING TESTS
    // ========================================

    test('Count meaningful lines ignores empty lines', () => {
        const countMeaningfulLines = (codeTracker as any).countMeaningfulLines.bind(codeTracker);

        const lines = [
            'const x = 5;',
            '',
            'const y = 10;',
            '',
            ''
        ];

        const count = countMeaningfulLines(lines, 'typescript');
        assert.strictEqual(count, 2);
    });

    test('Count meaningful lines ignores comments', () => {
        const countMeaningfulLines = (codeTracker as any).countMeaningfulLines.bind(codeTracker);

        const lines = [
            '// This is a comment',
            'const x = 5;',
            '// Another comment',
            'const y = 10;',
            '/* Multi-line comment */'
        ];

        const count = countMeaningfulLines(lines, 'typescript');
        assert.strictEqual(count, 2);
    });

    test('Count meaningful lines works with Python', () => {
        const countMeaningfulLines = (codeTracker as any).countMeaningfulLines.bind(codeTracker);

        const lines = [
            '# Comment',
            'def test():',
            '    # Another comment',
            '    return True',
            ''
        ];

        const count = countMeaningfulLines(lines, 'python');
        assert.strictEqual(count, 2);
    });

    // ========================================
    // CHANGE CALCULATION TESTS
    // ========================================

    test('Calculate line changes for additions', () => {
        const calculateLineChanges = (codeTracker as any).calculateLineChanges.bind(codeTracker);

        const oldContent = 'const x = 5;\nconst y = 10;';
        const newContent = 'const x = 5;\nconst y = 10;\nconst z = 15;';

        const change = calculateLineChanges(oldContent, newContent, 'typescript', '.ts');

        assert.strictEqual(change.linesAdded, 1);
        assert.strictEqual(change.linesDeleted, 0);
        assert.strictEqual(change.netChange, 1);
        assert.strictEqual(change.isMeaningful, true);
        assert.strictEqual(change.fileExtension, '.ts');
    });

    test('Calculate line changes for deletions', () => {
        const calculateLineChanges = (codeTracker as any).calculateLineChanges.bind(codeTracker);

        const oldContent = 'const x = 5;\nconst y = 10;\nconst z = 15;';
        const newContent = 'const x = 5;\nconst y = 10;';

        const change = calculateLineChanges(oldContent, newContent, 'typescript');

        assert.strictEqual(change.linesAdded, 0);
        assert.strictEqual(change.linesDeleted, 1);
    });

    test('Calculate line changes ignores comment additions', () => {
        const calculateLineChanges = (codeTracker as any).calculateLineChanges.bind(codeTracker);

        const oldContent = 'const x = 5;\nconst y = 10;';
        const newContent = 'const x = 5;\n// Comment\nconst y = 10;';

        const change = calculateLineChanges(oldContent, newContent, 'typescript');

        assert.strictEqual(change.isMeaningful, false);
        assert.strictEqual(change.netChange, 0); // No meaningful change
    });

    // ========================================
    // FILE TRACKING TESTS
    // ========================================

    test('Should track TypeScript files by default', () => {
        const shouldTrack = (codeTracker as any).shouldTrackDocument.bind(codeTracker);

        const mockDoc = {
            fileName: '/test/file.ts',
            languageId: 'typescript'
        };

        assert.strictEqual(shouldTrack(mockDoc), true);
    });

    test('Should track JavaScript files by default', () => {
        const shouldTrack = (codeTracker as any).shouldTrackDocument.bind(codeTracker);

        const mockDoc = {
            fileName: '/test/file.js',
            languageId: 'javascript'
        };

        assert.strictEqual(shouldTrack(mockDoc), true);
    });

    test('Should not track non-code files by default', () => {
        const shouldTrack = (codeTracker as any).shouldTrackDocument.bind(codeTracker);

        const mockDoc = {
            fileName: '/test/file.txt',
            languageId: 'plaintext'
        };

        assert.strictEqual(shouldTrack(mockDoc), false);
    });

    test('Should track all files when trackAllFiles is true', () => {
        const config = { ...DEFAULT_CONFIG, trackAllFiles: true };
        codeTracker.updateConfig(config);

        const shouldTrack = (codeTracker as any).shouldTrackDocument.bind(codeTracker);

        const mockDoc = {
            fileName: '/test/file.txt',
            languageId: 'plaintext'
        };

        assert.strictEqual(shouldTrack(mockDoc), true);
    });

    // ========================================
    // CONFIGURATION TESTS
    // ========================================

    test('Update config changes tracking behavior', () => {
        const newConfig = {
            ...DEFAULT_CONFIG,
            unlock: {
                ...DEFAULT_CONFIG.unlock,
                countMeaningfulLinesOnly: false
            }
        };

        codeTracker.updateConfig(newConfig);

        // This would now count all lines, not just meaningful ones
        const calculateLineChanges = (codeTracker as any).calculateLineChanges.bind(codeTracker);

        const oldContent = 'const x = 5;';
        const newContent = 'const x = 5;\n// Comment';

        const change = calculateLineChanges(oldContent, newContent, 'typescript');

        // With countMeaningfulLinesOnly: false, should count comment as a line
        assert.strictEqual(change.netChange, 1);
    });

    // ========================================
    // CACHE TESTS
    // ========================================

    test('Cache tracks document count', () => {
        const mockDoc1 = {
            uri: { toString: () => 'file:///test1.ts' },
            getText: () => 'const x = 5;',
            languageId: 'typescript'
        };

        const mockDoc2 = {
            uri: { toString: () => 'file:///test2.ts' },
            getText: () => 'const y = 10;',
            languageId: 'typescript'
        };

        (codeTracker as any).documentCache.set('file:///test1.ts', 'const x = 5;');
        (codeTracker as any).documentCache.set('file:///test2.ts', 'const y = 10;');

        assert.strictEqual(codeTracker.getTrackedDocumentCount(), 2);
    });

    test('Clear cache removes all documents', () => {
        (codeTracker as any).documentCache.set('file:///test1.ts', 'const x = 5;');
        (codeTracker as any).documentCache.set('file:///test2.ts', 'const y = 10;');

        codeTracker.clearCache();

        assert.strictEqual(codeTracker.getTrackedDocumentCount(), 0);
    });

    // ========================================
    // EVENT EMISSION TESTS
    // ========================================

    test('Code written event fires when meaningful code added', (done) => {
        // Set a very short debounce for testing
        const config = { ...DEFAULT_CONFIG, debounceTime: 10 };
        codeTracker.updateConfig(config);

        let eventFired = false;

        codeTracker.onCodeWritten((change) => {
            eventFired = true;
            assert.strictEqual(change.isMeaningful, true);
            assert.ok(change.netChange > 0);
            assert.strictEqual(change.fileExtension, '.ts');
            done();
        });

        // Simulate document change by directly calling processDocumentChange
        // (In real use, this would be triggered by VS Code events)

        // Set initial cache
        (codeTracker as any).documentCache.set('test-uri', 'const x = 5;');

        // Simulate change
        const mockDoc = {
            uri: { toString: () => 'test-uri' },
            getText: () => 'const x = 5;\nconst y = 10;',
            languageId: 'typescript',
            fileName: '/test/file.ts'
        };

        (codeTracker as any).processDocumentChange(mockDoc);
    });

    // ========================================
    // AGENT APPLY / BASELINE TESTS
    // ========================================

    test('Opening an existing file does not count its current lines', () => {
        let fired = false;
        codeTracker.onCodeWritten(() => {
            fired = true;
        });

        (codeTracker as any).seedBaseline({
            uri: { toString: () => 'file:///existing.ts' },
            getText: () => 'const x = 5;\nconst y = 10;',
            languageId: 'typescript',
            fileName: '/existing.ts',
            isUntitled: false
        });

        assert.strictEqual(fired, false);
        assert.strictEqual(codeTracker.getTrackedDocumentCount(), 1);
    });

    test('Apply after a seeded baseline counts only the new lines', () => {
        (codeTracker as any).seedBaseline({
            uri: { toString: () => 'file:///open.ts' },
            getText: () => 'const x = 5;',
            languageId: 'typescript',
            fileName: '/open.ts',
            isUntitled: false
        });

        let netChange = 0;
        codeTracker.onCodeWritten((change: { netChange: number }) => {
            netChange = change.netChange;
        });

        (codeTracker as any).processDocumentChange({
            uri: { toString: () => 'file:///open.ts' },
            getText: () => 'const x = 5;\nconst y = 10;\nconst z = 15;',
            languageId: 'typescript',
            fileName: '/open.ts'
        });

        assert.strictEqual(netChange, 2);
    });

    test('New file apply from an empty baseline counts meaningful lines', () => {
        (codeTracker as any).documentCache.set('file:///generated.ts', '');

        let netChange = 0;
        codeTracker.onCodeWritten((change: { netChange: number }) => {
            netChange = change.netChange;
        });

        (codeTracker as any).processDocumentChange({
            uri: { toString: () => 'file:///generated.ts' },
            getText: () => 'const x = 5;\nconst y = 10;',
            languageId: 'typescript',
            fileName: '/generated.ts'
        });

        assert.strictEqual(netChange, 2);
    });

    test('First sight of an existing file still does not count it', () => {
        let fired = false;
        codeTracker.onCodeWritten(() => {
            fired = true;
        });

        (codeTracker as any).processDocumentChange({
            uri: { toString: () => 'file:///unseen.ts' },
            getText: () => 'const x = 5;\nconst y = 10;',
            languageId: 'typescript',
            fileName: '/unseen.ts'
        });

        assert.strictEqual(fired, false);
    });

    test('Does not track files in node_modules', () => {
        const shouldTrack = (codeTracker as any).shouldTrackFileName.bind(codeTracker);
        assert.strictEqual(
            shouldTrack('/project/node_modules/lib/index.js'),
            false
        );
    });

    // ========================================
    // FILE EXTENSION TRACKING TESTS
    // ========================================

    test('Resolves longest matching tracked extension', () => {
        assert.strictEqual(
            resolveTrackedExtension('app.module.css', TRACKEDEXTENSION),
            '.module.css'
        );
        assert.strictEqual(
            resolveTrackedExtension('app.tsx', TRACKEDEXTENSION),
            '.tsx'
        );
        assert.strictEqual(
            resolveTrackedExtension('main.py', TRACKEDEXTENSION),
            '.py'
        );
        assert.strictEqual(
            resolveTrackedExtension('Styles.SCSS', TRACKEDEXTENSION),
            '.scss'
        );
    });

    test('Falls back to file suffix when not in tracked list', () => {
        assert.strictEqual(
            resolveTrackedExtension('notes.txt', TRACKEDEXTENSION),
            '.txt'
        );
        assert.strictEqual(
            resolveTrackedExtension('Makefile', TRACKEDEXTENSION),
            'unknown'
        );
    });

    test('Stores lines written per file extension', async () => {
        await storageManager.addLinesWritten(3, '.ts');
        await storageManager.addLinesWritten(2, '.py');
        await storageManager.addLinesWritten(1, '.ts');

        assert.strictEqual(storageManager.getTotalLinesWritten(), 6);
        assert.deepStrictEqual(storageManager.getLinesByExtension(), {
            '.ts': 4,
            '.py': 2
        });
        assert.deepStrictEqual(storageManager.getMostActiveExtension(), {
            extension: '.ts',
            lines: 4
        });
        assert.deepStrictEqual(storageManager.getLinesByExtensionSorted(), [
            { extension: '.ts', lines: 4 },
            { extension: '.py', lines: 2 }
        ]);
    });
});