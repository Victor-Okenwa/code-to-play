code-to-play/
├── .vscode/
│   ├── launch.json              # Debug configuration
│   └── tasks.json               # Build tasks
├── src/
│   ├── extension.ts             # Main entry point - activates extension
│   ├── core/
│   │   ├── GameManager.ts       # Manages game state, play limits, unlocking
│   │   ├── CodeTracker.ts       # Tracks lines of code written
│   │   ├── StorageManager.ts    # Handles persistence (plays, lines, scores)
│   │   └── types.ts             # Shared TypeScript interfaces/types
│   ├── ui/
│   │   ├── ActivityBarProvider.ts   # Tree view for game list in activity bar
│   │   ├── StatusBarManager.ts      # Status bar item controller
│   │   └── WebviewManager.ts        # Creates/manages game webviews
│   ├── games/
│   │   ├── registry.ts          # Central game registration
│   │   ├── BaseGame.ts          # Abstract base class for all games
│   │   ├── debug-snake/
│   │   │   ├── game.ts          # Game configuration & metadata
│   │   │   ├── index.html       # Game UI (main HTML)
│   │   │   ├── game.js          # Game logic
│   │   │   ├── styles.css       # Game-specific styles
│   │   │   └── assets/
│   │   │       └── icon.svg     # Snake game icon
│   │   └── whack-a-bug/
│   │       ├── game.ts          # Game configuration & metadata
│   │       ├── index.html       # Game UI (main HTML)
│   │       ├── game.js          # Game logic
│   │       ├── styles.css       # Game-specific styles
│   │       └── assets/
│   │           └── icon.svg     # Whack-a-Bug game icon
│   └── utils/
│       ├── constants.ts         # Config values (play limits, line thresholds)
│       └── logger.ts            # Logging utility
├── media/
│   ├── icons/
│   │   ├── extension-icon.png   # Extension icon (128x128)
│   │   ├── game-controller.svg  # Activity bar icon
│   │   ├── locked.svg           # Locked game indicator
│   │   └── unlocked.svg         # Unlocked game indicator
│   ├── fonts/
│   │   ├── PressStart2P-Regular.ttf
│   │   ├── PressStart2P.woff2
│   │   ├── Orbitron-Regular.ttf
│   │   ├── Orbitron-Bold.ttf
│   │   ├── Orbitron.woff2
│   │   └── font-licenses.txt    # License information for fonts
│   └── styles/
│       └── common.css           # Shared styles for all games
├── out/                         # Compiled JavaScript output (auto-generated)
├── node_modules/                # Dependencies (auto-generated)
├── .vscodeignore               # Files to exclude from extension package
├── .gitignore                  # Git ignore file
├── package.json                # Extension manifest & metadata
├── tsconfig.json               # TypeScript configuration
├── webpack.config.js           # Webpack bundling configuration
├── README.md                   # Extension documentation
├── CHANGELOG.md                # Version history
├── LICENSE                     # License file (MIT recommended)
└── .eslintrc.json             # ESLint configuration