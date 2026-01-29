/**
 * CodeTracker.ts
 * 
 * Tracks code changes in the editor to determine when games should be unlocked.
 * Monitors document changes and counts meaningful lines of code written.
 */

import * as vscode from 'vscode';
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
     * Debounce timer to prevent counting rapid changes as multiple lines
     */
    private debounceTimer: NodeJS.Timeout | null = null;

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
        // Listen for document changes
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(
            this.handleDocumentChange.bind(this)
        );

        // Listen for document saves (for more accurate counting)
        const saveDisposable = vscode.workspace.onDidSaveTextDocument(
            this.handleDocumentSave.bind(this)
        );

        this.disposables.push(changeDisposable, saveDisposable);
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

        // Ignore untitled or unsaved documents
        if (event.document.isUntitled) {
            return;
        }

        // Check if we should track this file type
        if (!this.shouldTrackDocument(event.document)) {
            return;
        }

        // Debounce to avoid counting rapid typing as multiple lines
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processDocumentChange(event.document);
        }, this.config.debounceTime);
    }

    /**
     * Handles document save events
     * Provides a definitive count of lines when file is saved
     * 
     * @param document - Saved document
     * @private
     */
    private handleDocumentSave(document: vscode.TextDocument): void {
        // Check if we should track this file type
        if (!this.shouldTrackDocument(document)) {
            return;
        }

        // Cancel any pending debounced change
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Process the final saved state
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
        const currentContent = document.getText();
        const cachedContent = this.documentCache.get(document.uri.toString());

        // If no cached content, this is the first time seeing this document
        if (!cachedContent) {
            this.documentCache.set(document.uri.toString(), currentContent);
            return;
        }

        // Calculate line changes
        const change = this.calculateLineChanges(
            cachedContent,
            currentContent,
            document.languageId
        );

        // Update cache
        this.documentCache.set(document.uri.toString(), currentContent);

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
     * @returns CodeChange object with details about the change
     * @private
     */
    private calculateLineChanges(
        oldContent: string,
        newContent: string,
        languageId: string
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
     * Gets regex patterns for comments in different languages
     * 
     * @param languageId - Programming language identifier
     * @returns Array of regex patterns matching comments
     * @private
     */
    private getCommentPatterns(languageId: string): RegExp[] {
        const patterns: RegExp[] = [];

        // C-style languages (JS, TS, Java, C++, C#, etc.)
        if (['javascript', 'typescript', 'java', 'cpp', 'c', 'csharp', 'go', 'rust', 'php'].includes(languageId)) {
            patterns.push(/^\/\//);  // Single-line comment
            patterns.push(/^\/\*/);  // Multi-line comment start
            patterns.push(/^\*/);    // Multi-line comment continuation
        }

        // Python, Ruby, Shell
        if (['python', 'ruby', 'shellscript', 'powershell'].includes(languageId)) {
            patterns.push(/^#/);     // Python/Ruby/Shell comment
        }

        // HTML/XML comments
        if (['html', 'xml', 'markdown'].includes(languageId)) {
            patterns.push(/^<!--/);  // HTML comment
        }

        // CSS comments
        if (['css', 'scss', 'less'].includes(languageId)) {
            patterns.push(/^\/\*/);  // CSS comment
        }

        return patterns;
    }

    /**
     * Determines if a document should be tracked based on config
     * 
     * @param document - Document to check
     * @returns True if document should be tracked
     * @private
     */
    private shouldTrackDocument(document: vscode.TextDocument): boolean {
        // Always track if trackAllFiles is enabled
        if (this.config.trackAllFiles) {
            return true;
        }

        // Check if file extension is in tracked list
        const fileName = document.fileName;
        return this.config.trackedExtensions.some(ext =>
            fileName.endsWith(ext)
        );
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
        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Dispose all event listeners
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        // Clear cache
        this.documentCache.clear();

        // Dispose event emitter
        this.onCodeWrittenEmitter.dispose();
    }
}