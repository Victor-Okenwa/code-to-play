export const TRACKEDEXTENSION = [
    // ---------- Programming Languages ----------
    '.js', '.mjs', '.cjs',
    '.ts', '.tsx', '.jsx',
    '.py',
    '.java',
    '.c', '.h',
    '.cpp', '.cc', '.cxx', '.hpp',
    '.cs',
    '.go',
    '.rs',
    '.rb',
    '.php',
    '.swift',
    '.kt', '.kts',
    '.scala',
    '.dart',
    '.r',
    '.jl',
    '.lua',
    '.pl',
    '.sh', '.bash',
    '.ps1',
    '.asm', '.s',
    '.f', '.f90',
    '.cob',
    '.groovy',
    '.hs',
    '.ex', '.exs',
    '.fs', '.fsi', '.fsx',
    '.clj', '.cljs', '.cljc',
    '.lisp', '.el',
    '.nim',
    '.zig',
    '.v',
    '.sol',
    '.gd',
    '.ada', '.adb', '.ads',
    '.ml', '.mli',
    '.cr',
    '.pony',
    '.awk',
    '.pro',
    '.tcl',
    '.rkt',
    '.e',
    '.smalltalk',

    // ---------- Markup / Markdown / Data ----------
    '.html', '.htm',
    '.xml',
    '.md', '.markdown',
    '.mdx',
    '.rst',
    '.adoc',
    '.tex',
    '.bib',
    '.yml', '.yaml',
    '.json',
    '.jsonc',
    '.toml',
    '.ini',
    '.cfg',
    '.csv',
    '.tsv',
    '.svg',
    '.xhtml',
    '.xaml',
    '.opml',
    // '.org',
    // '.wiki',
    // '.txt',

    // ---------- Styling / UI / Design ----------
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.styl',
    '.pcss',
    '.postcss',
    '.tailwind.css',
    '.module.css',
    '.module.scss',

    // ---------- Mobile / UI Framework Styling ----------
    // '.qml',
    // '.ux',
    // '.themes',
    // '.tokens.json',
];

/**
 * Resolves the tracked file extension for a path.
 * Longest match wins so `file.module.css` maps to `.module.css`, not `.css`.
 * Falls back to the last suffix, or `unknown` when the file has no extension.
 */
export function resolveTrackedExtension(
    fileName: string,
    trackedExtensions: readonly string[] = TRACKEDEXTENSION
): string {
    const lowerName = fileName.toLowerCase();
    const matches = trackedExtensions.filter((ext) =>
        lowerName.endsWith(ext.toLowerCase())
    );

    if (matches.length > 0) {
        return matches.reduce((longest, ext) =>
            ext.length > longest.length ? ext : longest
        );
    }

    const lastDot = lowerName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === lowerName.length - 1) {
        return 'unknown';
    }

    return lowerName.slice(lastDot);
}
