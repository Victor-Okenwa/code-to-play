# Changelog

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
