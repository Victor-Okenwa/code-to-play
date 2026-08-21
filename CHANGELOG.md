# Changelog

## [1.1.0] - 2026-08-21

### Added

- **Pro games**:
  - Call Stack, Merge Conflict, and Kernel Panic join Debug Snake and Whack-a-Bug
  - New Pro checkouts include a 7-day free trial
  - Extra play spaces and account actions in the activity bar (sign in, Go Pro, manage subscription)
- **Kernel Panic**:
  - Fly a compact kernel craft instead of a dart silhouette
  - Threat kills can drop colored power-ups: grey shield, red rapid fire, magenta spread shot, blue weaker enemies, yellow score boost, and green health
  - Survival run — no 60-second clock. The round ends when HP hits zero
  - Threat climbs the longer you last (faster spawns, tougher kinds, denser panic waves)
  - HUD shows Threat instead of Time; About this game and How to Play match the new rules
- **About this game**:
  - Always-visible about section on every game, covering rules, scoring, and controls
- **Optional stats sync**:
  - Signed-in players who opt in on the website can sync local high scores and play counts — still off by default

### Changed

- Locked Pro games and exhausted-play toasts point to subscription / extra play spaces instead of a dead end
- Code tracking seeds a baseline when a file is opened so the first edit in a session counts more reliably
- In-game copy and difficulty cards for Kernel Panic describe the ramp and power-up colors

## [1.0.0] - 2026-08-07

### Changed

- **Unlock threshold increased to 1000 lines**:
  - Default lines required to unlock games raised from 100 to 1000 meaningful lines of code
  - Activity bar progress fallback now uses the shared default config instead of a hardcoded value
  - Status bar, unlock notifications, and in-game messages reflect the new threshold automatically

### Notes

- First major release (1.0.0) — marks a stable milestone for Code to Play
- Users with a previously saved custom config may still have the old 100-line threshold until config is reset

## [0.0.3] - 2026-07-18

### Added in 0.0.3

- **Whack-a-Bug Full Difficulty Levels**:
  - Unlocked Medium and Hard alongside Easy
  - Code-themed bug types (syntax, null, overflow) with distinct point values
  - Hard mode avoidable green “feature” bugs (−25) and rare criticals (+30)
  - Accordion difficulty cards with color swatches and scoring rules per level
  - In-game bug legend for Medium/Hard
- **Per-Difficulty High Scores** (Debug Snake and Whack-a-Bug):
  - Separate high scores for each difficulty level
  - Extension host stores scores in a `highScores` map (uses `default` for games without difficulty)
  - Best score shown on each difficulty card before play
  - View Stats and activity-bar tooltips list scores by difficulty
  - “New high score” toast is scoped to the difficulty that improved

### Changed

- **Whack-a-Bug Hard pacing**:
  - Tuned spawn interval and bug visibility to keep Hard challenging but more playable
- **High score persistence**:
  - Legacy single `highScore` values migrate to `highScores.default` on load

## [0.0.2] - 2026-07-06

### Added in 0.0.2

- **Sound Effects and Audio Assets**:
  - Added game SFX assets for gameplay feedback (`pop` and `slurp`)
  - Added inline SoundManager support for game-specific audio playback
- **Game Difficulty Controls**:
  - Added difficulty selection to improve gameplay customization
- **Shared Game Chrome Controls**:
  - Added shared in-game toolbar controls for mute and focus play workflows

### Changed

- **Sound System Enhancements**:
  - Refactored sound handling to use centralized SoundManager access
  - Improved global sound configuration integration with extension settings
- **Visual and UX Polish**:
  - Improved game UI styling and state transitions for a cleaner in-editor experience
  - Enhanced game chrome behavior to better match VS Code dark-theme aesthetics

### Performance in 0.0.2

- Reduced repeated UI state handling by consolidating shared game chrome logic

## [0.0.1] - 2026-02-04

### Added

- Initial release of Code to Play
- **Debug Snake Game**: Classic snake game with debugging theme
  - Control green snake to catch red ladybugs (bugs)
  - Progressive difficulty - speed increases every 5 bugs
  - High score tracking with local storage
  - Reset high score functionality
  - Pause/resume controls
- **Whack-a-Bug Game**: Whack-a-Mole style game with coding theme
  - 60-second time limit
  - Click bugs as they pop up
  - Progressive difficulty - bugs appear faster over time
  - High score tracking
  - Reset high score functionality
- **Code Tracking System**:
  - Automatic tracking of meaningful lines of code
  - Excludes comments and blank lines
  - Configurable file type tracking
  - Supports 13+ programming languages
  - Debounced change detection
- **Unlock System**:
  - Write 100 lines to unlock 5 plays (configurable)
  - Global play counter shared across all games
  - Visual progress tracking in status bar
  - Unlock notifications
- **Activity Bar Integration**:
  - Dedicated Code to Play view
  - Shows plays remaining
  - Lists all available games
  - Game status indicators (locked/unlocked)
  - Quick play buttons
  - Sticky footer with action buttons
- **Statistics Dashboard**:
  - Total lines written
  - Total plays across all games
  - Combined high scores
  - Per-game statistics
  - Beautiful webview panel display
  - Export functionality
- **Status Bar Integration**:
  - Real-time unlock progress
  - Plays remaining counter
  - Quick access to games
- **Configuration Options**:
  - Lines required to unlock (default: 100)
  - Plays per unlock (default: 5)
  - Count meaningful lines only toggle
  - Show unlock notifications toggle
  - Debounce time adjustment
  - Track all files or specific extensions
  - Customizable tracked file extensions
- **Data Management**:
  - Local storage using VS Code API
  - Export statistics to JSON
  - Import/restore data (debug feature)
  - Reset individual games
  - Reset all games
  - No cloud sync - privacy-focused
- **UI Components**:
  - Custom fonts (Press Start 2P, Orbitron)
  - Responsive game canvases
  - VS Code theme integration
  - Smooth animations
  - Interactive controls
- **Developer Features** (Debug only):
  - Unlock all games command
  - Lock all games command
  - Import data command
  - Detailed console logging

### Security

- No telemetry or external data collection
- All data stored locally
- No network requests
- Content Security Policy enforced in webviews
- Nonce-based script execution

### Performance

- ESBuild for fast compilation (13x faster than webpack)
- Optimized bundle size
- Lazy loading of game assets
- Efficient event listener management
- Debounced code change detection
