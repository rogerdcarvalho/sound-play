// ---------------------------------------------------------------
// ESM / TypeScript version of the original CommonJS implementation.
// ---------------------------------------------------------------

import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Helper – generate a short random id for each playback instance
// ---------------------------------------------------------------------------
function makeId(): string {
  // 4 bytes → 8‑hex characters, e.g. "9b1c7a3f"
  return crypto.randomBytes(4).toString('hex');
}

// ---------------------------------------------------------------------------
// Platform‑specific command builders
// ---------------------------------------------------------------------------
const macPlayCommand = (filePath: string, volume: number): string[] => [
  'afplay',
  filePath,
  '-v',
  String(volume),
];

const windowsPowerShellScript = (filePath: string, volume: number): string => `
Add-Type -AssemblyName presentationCore;
$player = New-Object system.windows.media.mediaplayer;
$player.open('${filePath.replace(/'/g, "''")}');
$player.Volume = ${volume};
$player.Play();
# Keep the process alive until the media finishes
Start-Sleep -s $player.NaturalDuration.TimeSpan.TotalSeconds;
`;

const windowsPlayCommand = (filePath: string, volume: number): string[] => [
  'powershell',
  '-NoProfile',
  '-Command',
  windowsPowerShellScript(filePath, volume),
];

// ---------------------------------------------------------------------------
// Store active children so we can stop them later
// ---------------------------------------------------------------------------
type PlaybackId = string;
const activeChildren = new Map<PlaybackId, ChildProcessWithoutNullStreams>();

// ---------------------------------------------------------------------------
// Public API – exported as named functions (you can also re‑export a single object if you prefer)
// ---------------------------------------------------------------------------

/**
 * Start playing an audio file.
 *
 * @param filePath Absolute (or relative) path to the audio file.
 * @param volume   Normalised volume (0‑1). On macOS it is scaled internally
 *                 to 0‑2 because `afplay` uses a different range.
 *
 * @returns A opaque playback‑id that can be passed to {@link stop}.
 */
export function play(filePath: string, volume = 0.5): PlaybackId {
  // Resolve the path once – PowerShell needs Windows‑style backslashes,
  // while macOS accepts normal POSIX paths.
  const absolutePath = path.resolve(filePath);

  // Normalise volume per platform
  const volForOs =
    process.platform === 'darwin' ? Math.min(2, volume * 2) : volume;

  // Build the command + args array
  const [cmd, ...args] =
    process.platform === 'darwin'
      ? macPlayCommand(absolutePath, volForOs)
      : windowsPlayCommand(absolutePath, volForOs);

  // Spawn the child – we **do not** use stdio: 'ignore' because on Windows
  // PowerShell may emit some warning messages that would otherwise block.
  const child = spawn(cmd, args, {
    detached: false,
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;

  // Create an id and store it so we can kill later
  const id = makeId();
  activeChildren.set(id, child);

  // Clean up the map when the process ends or errors.
  const cleanup = () => activeChildren.delete(id);
  child.once('exit', cleanup);
  child.once('error', cleanup);

  return id;
}

/**
 * Stop playback that was started with {@link play}.
 *
 * @param id The playback‑id returned by {@link play}.
 * @returns `true` if a process was found and killed, otherwise `false`.
 */
export function stop(id: PlaybackId): boolean {
  const child = activeChildren.get(id);
  if (!child) return false;

  // On POSIX we can send SIGTERM (default). On Windows the same call
  // translates to TerminateProcess which is sufficient for our short‑lived
  // PowerShell script.
  child.kill(); // default signal = 'SIGTERM'

  // Remove it immediately – the `exit` listener will also clean up,
  // but we want subsequent calls to return false right away.
  activeChildren.delete(id);
  return true;
}

/**
 * Convenience: stop **all** currently playing sounds.
 */
export function stopAll(): void {
  for (const id of Array.from(activeChildren.keys())) {
    stop(id);
  }
}

// ---------------------------------------------------------------
// Optional default export – mirrors the original `module.exports` shape
// ---------------------------------------------------------------
export default { play, stop, stopAll };
