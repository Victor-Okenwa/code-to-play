/**
 * CodeTracker.ts
 * 
 * Tracks code changes in the editor to determine when games should be unlocked.
 * Monitors document changes and counts meaningful lines of code written.
 */

import * as vscode from 'vscode';
import { resolveTrackedExtension } from '../constants/TrackedExtensions';
import { CodeChange, ExtensionConfig } from './types';
import { StorageManager } from './StorageManager';

/**
 * Tracks user's coding activity to enable game unlocks
 */
export class CodeTracker {
    /**
     * Disposables for cleanup
     */
    private disposables: vscode.Disposable[] = [];

    /**
     * Per-document debounce timers so multi-file agent applies all count
     */
    private debounceTimers = new Map<string, NodeJS.Timeout>();

    /**
     * New file URIs already credited, so create events are not double-counted
     */
    private creditedNewFiles = new Set<string>();

    /**
     * Event emitter for code change events
     */
    private onCodeWrittenEmitter = new vscode.EventEmitter<CodeChange>();

    /**
     * Public event that fires when meaningful code is written
     */
    public readonly onCodeWritten = this.onCodeWrittenEmitter.event;

    /**
     * Cache of document content to compare changes
     */
    private documentCache = new Map<string, string>();

    /**
     * Current extension configuration
     */
    private config: ExtensionConfig;

    /**
     * Creates a new CodeTracker instance
     * 
     * @param storageManager - Storage manager for persisting line counts
     */
    constructor(private storageManager: StorageManager) {
        this.config = storageManager.getConfig();
        this.setupListeners();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Sets up event listeners for document changes
     * 
     * @private
     */
    private setupListeners(): void {
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(
                this.handleDocumentChange.bind(this)
            ),
            vscode.workspace.onDidSaveTextDocument(
                this.handleDocumentSave.bind(this)
            ),
            vscode.workspace.onDidOpenTextDocument(
                this.handleDocumentOpen.bind(this)
            ),
            vscode.workspace.onDidCreateFiles(
                this.handleFilesCreated.bind(this)
            )
        );

        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.disposables.push(
            watcher,
            watcher.onDidCreate((uri) => {
                void this.creditNewFile(uri);
            }),
            watcher.onDidChange((uri) => {
                this.handleFileChangedOnDisk(uri);
            })
        );

        for (const document of vscode.workspace.textDocuments) {
            this.seedBaseline(document);
        }
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    /**
     * Handles document change events
     * Debounces rapid changes to avoid over-counting
     * 
     * @param event - Document change event
     * @private
     */
    private handleDocumentChange(
        event: vscode.TextDocumentChangeEvent
    ): void {
        // Ignore if no content changes
        if (event.contentChanges.length === 0) {
            return;
        }

        if (event.document.isUntitled) {
            return;
        }

        if (!this.shouldTrackDocument(event.document)) {
            return;
        }

        this.scheduleDocumentProcess(event.document);
    }

    /**
     * Seeds a baseline when a file is opened so the next apply or edit is a diff
     *
     * @param document - Opened document
     * @private
     */
    private handleDocumentOpen(document: vscode.TextDocument): void {
        this.seedBaseline(document);
    }

    /**
     * Credits meaningful lines in files created by the editor or an agent
     *
     * @param event - File create event
     * @private
     */
    private handleFilesCreated(event: vscode.FileCreateEvent): void {
        for (const uri of event.files) {
            void this.creditNewFile(uri);
        }
    }

    /**
     * Diffs a disk write against a known baseline (open or previously seen file)
     *
     * @param uri - Changed file
     * @private
     */
    private handleFileChangedOnDisk(uri: vscode.Uri): void {
        if (uri.scheme !== 'file') {
            return;
        }

        if (!this.shouldTrackFileName(uri.fsPath)) {
            return;
        }

        if (!this.documentCache.has(uri.toString())) {
            return;
        }

        this.scheduleUriProcess(uri);
    }

    /**
     * Handles document save events
     * Provides a definitive count of lines when file is saved
     * 
     * @param document - Saved document
     * @private
     */
    private handleDocumentSave(document: vscode.TextDocument): void {
        if (document.isUntitled || !this.shouldTrackDocument(document)) {
            return;
        }

        this.cancelScheduledProcess(document.uri.toString());
        this.processDocumentChange(document);
    }

    // ========================================
    // CHANGE PROCESSING
    // ========================================

    /**
     * Processes a document change to count meaningful lines
     * 
     * @param document - Changed document
     * @private
     */
    private processDocumentChange(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        const currentContent = document.getText();

        // First time seeing this document: store a baseline, do not count
        if (!this.documentCache.has(key)) {
            this.documentCache.set(key, currentContent);
            return;
        }

        const cachedContent = this.documentCache.get(key) ?? '';

        // Calculate line changes
        const change = this.calculateLineChanges(
            cachedContent,
            currentContent,
            document.languageId,
            resolveTrackedExtension(document.fileName, this.config.trackedExtensions)
        );

        this.documentCache.set(key, currentContent);

        // Only emit if there's a meaningful change
        if (change.isMeaningful && change.netChange > 0) {
            this.onCodeWrittenEmitter.fire(change);
        }
    }

    /**
     * Calculates the meaningful line changes between two versions of content
     * 
     * @param oldContent - Previous content
     * @param newContent - Current content
     * @param languageId - Programming language identifier
     * @param fileExtension - Tracked file extension
     * @returns CodeChange object with details about the change
     * @private
     */
    private calculateLineChanges(
        oldContent: string,
        newContent: string,
        languageId: string,
        fileExtension = ''
    ): CodeChange {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');

        // Count meaningful lines in each version
        const oldMeaningfulCount = this.countMeaningfulLines(
            oldLines,
            languageId
        );
        const newMeaningfulCount = this.countMeaningfulLines(
            newLines,
            languageId
        );

        // Calculate changes
        const netChange = newLines.length - oldLines.length;
        const meaningfulNetChange = newMeaningfulCount - oldMeaningfulCount;

        return {
            linesAdded: Math.max(0, netChange),
            linesDeleted: Math.max(0, -netChange),
            netChange: this.config.unlock.countMeaningfulLinesOnly
                ? meaningfulNetChange
                : netChange,
            isMeaningful: meaningfulNetChange > 0,
            languageId,
            fileExtension,
            timestamp: Date.now()
        };
    }

    /**
     * Counts meaningful lines in an array of lines
     * Ignores comments, whitespace, and trivial changes
     * 
     * @param lines - Array of code lines
     * @param languageId - Programming language identifier
     * @returns Count of meaningful lines
     * @private
     */
    private countMeaningfulLines(lines: string[], languageId: string): number {
        let count = 0;

        for (const line of lines) {
            if (this.isLineMeaningful(line.trim(), languageId)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Determines if a single line is meaningful (not comment/whitespace)
     * 
     * @param line - Trimmed line of code
     * @param languageId - Programming language identifier
     * @returns True if line contains meaningful code
     * @private
     */
    private isLineMeaningful(line: string, languageId: string): boolean {
        // Empty lines are not meaningful
        if (line.length === 0) {
            return false;
        }

        // Single character lines are usually not meaningful (just braces, etc.)
        if (line.length === 1 && /[{}\[\]();,]/.test(line)) {
            return false;
        }

        // Check for comments based on language
        const commentPatterns = this.getCommentPatterns(languageId);
        for (const pattern of commentPatterns) {
            if (pattern.test(line)) {
                return false;
            }
        }

        // Line passed all checks, it's meaningful
        return true;
    }

    /**
     * Map of language IDs to their comment regex patterns
     */
    private readonly commentPatternMap: Record<string, RegExp[]> = {
        // ---------- C-style + JSDoc ----------
        javascript: [
            /^\/\/.*/,   // single-line
            /^\/\*\*/,   // JSDoc block start
            /^\/\*/,     // normal block start
            /^\*/        // block / JSDoc continuation
        ],
        javascriptreact: [
            /^\/\/.*/,
            /^\/\*\*/,
            /^\/\*/,
            /^\*/
        ],
        typescript: [
            /^\/\/.*/,
            /^\/\*\*/,
            /^\/\*/,
            /^\*/
        ],
        typescriptreact: [
            /^\/\/.*/,
            /^\/\*\*/,
            /^\/\*/,
            /^\*/
        ],
        java: [
            /^\/\/.*/,
            /^\/\*\*/,
            /^\/\*/,
            /^\*/
        ],
        c: [/^\/\/.*/, /^\/\*/, /^\*/],
        cpp: [/^\/\/.*/, /^\/\*/, /^\*/],
        csharp: [/^\/\/.*/, /^\/\*/, /^\*/],
        go: [/^\/\/.*/, /^\/\*/, /^\*/],
        rust: [/^\/\/.*/, /^\/\*/, /^\*/],
        php: [/^\/\/.*/, /^\/\*/, /^\*/],
        swift: [/^\/\/.*/, /^\/\*/, /^\*/],
        kotlin: [/^\/\/.*/, /^\/\*/, /^\*/],
        scala: [/^\/\/.*/, /^\/\*/, /^\*/],
        'objective-c': [/^\/\/.*/, /^\/\*/, /^\*/],
        zig: [/^\/\/.*/, /^\/\*/, /^\*/],

        // ---------- Hash-style ----------
        python: [/^#.*/],
        ruby: [/^#.*/],
        shellscript: [/^#.*/],
        bash: [/^#.*/],
        zsh: [/^#.*/],
        powershell: [/^#.*/],
        makefile: [/^#.*/],
        perl: [/^#.*/],
        r: [/^#.*/],
        julia: [/^#.*/],
        yaml: [/^#.*/],
        toml: [/^#.*/],

        // ---------- HTML / XML ----------
        html: [/^<!--/],
        xml: [/^<!--/],
        markdown: [/^<!--/],
        mdx: [/^<!--/],
        xhtml: [/^<!--/],
        svg: [/^<!--/],

        // ---------- CSS ----------
        css: [/^\/\*/, /^\*/],
        scss: [/^\/\*/, /^\*/],
        sass: [/^\/\*/, /^\*/],
        less: [/^\/\*/, /^\*/],
        stylus: [/^\/\*/, /^\*/],
        postcss: [/^\/\*/, /^\*/],

        // ---------- Lua ----------
        lua: [/^--/, /^--\[\[/],

        // ---------- SQL ----------
        sql: [/^--/, /^\/\*/],
        mysql: [/^--/, /^\/\*/],
        postgresql: [/^--/, /^\/\*/],
        sqlite: [/^--/, /^\/\*/],

        // ---------- Haskell / Elm ----------
        haskell: [/^--/, /^{-/],
        elm: [/^--/, /^{-/],

        // ---------- Lisp family ----------
        lisp: [/^;/],
        scheme: [/^;/],
        clojure: [/^;/],

        // ---------- Assembly ----------
        asm: [/^;/, /^#/],
        assembly: [/^;/, /^#/],

        // ---------- MATLAB / Octave ----------
        matlab: [/^%/],
        octave: [/^%/]
    };

    /**
     * Gets regex patterns for comments in different languages
     * 
     * @param languageId - Programming language identifier
     * @returns Array of regex patterns matching comments
     * @private
     */
    private getCommentPatterns(languageId: string): RegExp[] {
        return this.commentPatternMap[languageId] ?? [];
    }


    /**
     * Determines if a document should be tracked based on config
     * 
     * @param document - Document to check
     * @returns True if document should be tracked
     * @private
     */
    private shouldTrackDocument(document: vscode.TextDocument): boolean {
        if (document.isUntitled) {
            return false;
        }

        return this.shouldTrackFileName(document.fileName);
    }

    /**
     * Whether a file path uses a tracked extension
     *
     * @param fileName - File path or name
     * @returns True if the file should be tracked
     * @private
     */
    private shouldTrackFileName(fileName: string): boolean {
        if (this.isIgnoredPath(fileName)) {
            return false;
        }

        if (this.config.trackAllFiles) {
            return true;
        }

        const lowerName = fileName.toLowerCase();
        return this.config.trackedExtensions.some((ext) =>
            lowerName.endsWith(ext.toLowerCase())
        );
    }

    /**
     * Skips generated and dependency folders so installs do not count as writing
     *
     * @param fileName - File path
     * @returns True if the path should be ignored
     * @private
     */
    private isIgnoredPath(fileName: string): boolean {
        const normalized = fileName.replace(/\\/g, '/').toLowerCase();
        return [
            '/node_modules/',
            '/.git/',
            '/dist/',
            '/out/',
            '/build/',
            '/.next/',
            '/coverage/',
            '/vendor/'
        ].some((segment) => normalized.includes(segment));
    }

    /**
     * Stores current content as the baseline without crediting lines
     *
     * @param document - Document to seed
     * @private
     */
    private seedBaseline(document: vscode.TextDocument): void {
        if (!this.shouldTrackDocument(document)) {
            return;
        }

        const key = document.uri.toString();
        if (!this.documentCache.has(key)) {
            this.documentCache.set(key, document.getText());
        }
    }

    /**
     * Credits a newly created file as a diff from empty
     *
     * @param uri - Created file
     * @private
     */
    private async creditNewFile(uri: vscode.Uri): Promise<void> {
        if (uri.scheme !== 'file') {
            return;
        }

        if (!this.shouldTrackFileName(uri.fsPath)) {
            return;
        }

        const key = uri.toString();
        if (this.creditedNewFiles.has(key)) {
            return;
        }

        this.creditedNewFiles.add(key);
        this.documentCache.set(key, '');

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            this.processDocumentChange(document);
        } catch {
            this.creditedNewFiles.delete(key);
            this.documentCache.delete(key);
        }
    }

    /**
     * Debounces processing for an already-loaded document
     *
     * @param document - Document to process
     * @private
     */
    private scheduleDocumentProcess(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        this.cancelScheduledProcess(key);
        this.debounceTimers.set(
            key,
            setTimeout(() => {
                this.debounceTimers.delete(key);
                this.processDocumentChange(document);
            }, this.config.debounceTime)
        );
    }

    /**
     * Debounces processing for a file that changed on disk
     *
     * @param uri - Changed file
     * @private
     */
    private scheduleUriProcess(uri: vscode.Uri): void {
        const key = uri.toString();
        this.cancelScheduledProcess(key);
        this.debounceTimers.set(
            key,
            setTimeout(() => {
                this.debounceTimers.delete(key);
                void vscode.workspace.openTextDocument(uri).then(
                    (document) => this.processDocumentChange(document),
                    () => undefined
                );
            }, this.config.debounceTime)
        );
    }

    /**
     * Cancels a pending debounced process for a document
     *
     * @param key - Document URI string
     * @private
     */
    private cancelScheduledProcess(key: string): void {
        const timer = this.debounceTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Updates the configuration used by the tracker
     * 
     * @param config - New configuration
     */
    updateConfig(config: ExtensionConfig): void {
        this.config = config;
    }

    /**
     * Gets the current count of tracked documents in cache
     * 
     * @returns Number of documents being tracked
     */
    getTrackedDocumentCount(): number {
        return this.documentCache.size;
    }

    /**
     * Clears the document cache
     * Useful for testing or resetting state
     */
    clearCache(): void {
        this.documentCache.clear();
        this.creditedNewFiles.clear();
    }

    /**
     * Manually processes a document to count lines
     * Useful for testing or initial document scan
     * 
     * @param document - Document to process
     * @returns CodeChange representing current document state
     */
    processDocument(document: vscode.TextDocument): CodeChange | null {
        if (!this.shouldTrackDocument(document)) {
            return null;
        }

        const content = document.getText();
        const lines = content.split('\n');
        const meaningfulCount = this.countMeaningfulLines(
            lines,
            document.languageId
        );

        return {
            linesAdded: meaningfulCount,
            linesDeleted: 0,
            netChange: meaningfulCount,
            isMeaningful: meaningfulCount > 0,
            languageId: document.languageId,
            fileExtension: resolveTrackedExtension(
                document.fileName,
                this.config.trackedExtensions
            ),
            timestamp: Date.now()
        };
    }

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Disposes of all resources
     * Call when extension is deactivated
     */
    dispose(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        this.documentCache.clear();
        this.creditedNewFiles.clear();

        // Dispose event emitter
        this.onCodeWrittenEmitter.dispose();
    }
}