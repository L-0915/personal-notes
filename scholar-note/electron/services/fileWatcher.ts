// electron/services/fileWatcher.ts
import { watch, type FSWatcher as ChokidarWatcher } from 'chokidar';

export type { ChokidarWatcher as FSWatcher };

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
}

type WatchCallback = (event: WatchEvent) => void;

/* ------------------------------------------------------------------ */
/*  Start / Stop                                                       */
/* ------------------------------------------------------------------ */

/** Start watching a vault directory for markdown file changes. */
export function startFileWatcher(
  vaultPath: string,
  onEvent: WatchCallback,
): ChokidarWatcher {
  const pattern = 'notes/**/*.md';

  const watcher = watch(pattern, {
    cwd: vaultPath,
    ignored: [
      /(^|[/\\])\../,        // dotfiles and dotdirs
      '**/node_modules/**',
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath: string) => {
    onEvent({ type: 'add', filePath });
  });

  watcher.on('change', (filePath: string) => {
    onEvent({ type: 'change', filePath });
  });

  watcher.on('unlink', (filePath: string) => {
    onEvent({ type: 'unlink', filePath });
  });

  watcher.on('error', (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[fileWatcher] error: ${message}\n`);
  });

  return watcher;
}

/**
 * Gracefully stop a running file watcher.
 */
export function stopFileWatcher(watcher: ChokidarWatcher): void {
  void watcher.close();
}
