// src/audio-player.ts
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
/* --------------------------------------------------------------------- */
/* Helper – generate a short random id for each playback instance        */
/* --------------------------------------------------------------------- */
function makeId() {
    return crypto.randomBytes(4).toString('hex'); // e.g. "9b1c7a3f"
}
/* --------------------------------------------------------------------- */
/* Platform‑specific command builders                                    */
/* --------------------------------------------------------------------- */
const macPlayCommand = (filePath, volume) => [
    'afplay',
    filePath,
    '-v',
    String(volume),
];
const windowsPowerShellScript = (filePath, volume) => `
Add-Type -AssemblyName presentationCore;
$player = New-Object system.windows.media.mediaplayer;
$player.open('${filePath.replace(/'/g, "''")}');
$player.Volume = ${volume};
$player.Play();
# Keep the process alive until the media finishes
Start-Sleep -s $player.NaturalDuration.TimeSpan.TotalSeconds;
`;
const windowsPlayCommand = (filePath, volume) => [
    'powershell',
    '-NoProfile',
    '-Command',
    windowsPowerShellScript(filePath, volume),
];
/* --------------------------------------------------------------------- */
/* Store active children so we can stop them later                        */
/* --------------------------------------------------------------------- */
const activeChildren = new Map();
/* --------------------------------------------------------------------- */
/* Public API                                                            */
/* --------------------------------------------------------------------- */
/**
 * Start playing an audio file.
 *
 * @param filePath Absolute (or relative) path to the audio file.
 * @param volume   Normalised volume (0‑1). On macOS it is scaled internally
 *                 to 0‑2 because `afplay` uses a different range.
 *
 * @returns An object containing:
 *   - `id`: the opaque playback‑id you can later pass to {@link stop}.
 *   - `finished`: a promise that resolves when the sound stops playing.
 *
 * If you only need the id (the old behaviour) you can destructure it:
 *
 * ```ts
 * const { id } = play('ding.wav');
 * // or simply: const id = (await play('ding.wav')).id;
 * ```
 */
export function play(filePath, volume = 0.5) {
    // Resolve the path once – PowerShell needs Windows‑style backslashes,
    // while macOS accepts normal POSIX paths.
    const absolutePath = path.resolve(filePath);
    // Normalise volume per platform
    const volForOs = process.platform === 'darwin' ? Math.min(2, volume * 2) : volume;
    // Build the command + args array
    const [cmd, ...args] = process.platform === 'darwin'
        ? macPlayCommand(absolutePath, volForOs)
        : windowsPlayCommand(absolutePath, volForOs);
    // Spawn the child – we **do not** use stdio: 'ignore' because on Windows
    // PowerShell may emit warning messages that would otherwise block.
    const child = spawn(cmd, args, {
        detached: false,
        windowsHide: true,
    });
    // Create an id and store it so we can kill later
    const id = makeId();
    activeChildren.set(id, child);
    // -----------------------------------------------------------------
    // Build the promise that resolves when the process ends (or errors)
    // -----------------------------------------------------------------
    let resolveFinished;
    const finished = new Promise((resolve) => {
        resolveFinished = resolve;
    });
    const cleanup = () => {
        activeChildren.delete(id);
        resolveFinished(); // <-- resolve the promise
    };
    child.once('exit', cleanup);
    child.once('error', cleanup);
    return { id, finished };
}
/**
 * Stop playback that was started with {@link play}.
 *
 * @param id The playback‑id returned by {@link play}.
 * @returns `true` if a process was found and killed, otherwise `false`.
 */
export function stop(id) {
    const child = activeChildren.get(id);
    if (!child)
        return false;
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
export function stopAll() {
    for (const id of Array.from(activeChildren.keys())) {
        stop(id);
    }
}
/* --------------------------------------------------------------------- */
/* Default export – mirrors the original `module.exports` shape            */
/* --------------------------------------------------------------------- */
export default { play, stop, stopAll };
//# sourceMappingURL=audio-player.js.map