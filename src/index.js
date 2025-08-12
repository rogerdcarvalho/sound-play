const { spawn } = require('child_process')
const path = require('path')
const crypto = require('crypto')

// ---------------------------------------------------------------------------
// Helper – generate a short random id for each playback instance
// ---------------------------------------------------------------------------
function makeId() {
  return crypto.randomBytes(4).toString('hex') // e.g. "9b1c7a3f"
}

// ---------------------------------------------------------------------------
// Platform‑specific command builders
// ---------------------------------------------------------------------------
const macPlayCommand = (filePath, volume) => [
  'afplay',
  filePath,
  '-v',
  String(volume),
]

const windowsPowerShellScript = (filePath, volume) => `
Add-Type -AssemblyName presentationCore;
$player = New-Object system.windows.media.mediaplayer;
$player.open('${filePath.replace(/'/g, "''")}');
$player.Volume = ${volume};
$player.Play();
# Keep the process alive until the media finishes
Start-Sleep -s $player.NaturalDuration.TimeSpan.TotalSeconds;
`

const windowsPlayCommand = (filePath, volume) => [
  'powershell',
  '-NoProfile',
  '-Command',
  windowsPowerShellScript(filePath, volume),
]

// ---------------------------------------------------------------------------
// Store active children so we can stop them later
// ---------------------------------------------------------------------------
const activeChildren = new Map() // id → ChildProcess

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
module.exports = {
  /**
   * Start playing an audio file.
   *
   * @param {string} filePath Absolute (or relative) path to the audio file.
   * @param {number} [volume=0.5] Normalised volume (0‑1). On macOS it is scaled
   *                              internally to 0‑2 because `afplay` uses a different range.
   *
   * @returns {string} An opaque playback‑id that can be passed to `stop(id)`.
   */
  play(filePath, volume = 0.5) {
    // Resolve the path once – PowerShell needs Windows‑style backslashes,
    // while macOS accepts normal POSIX paths.
    const absolutePath = path.resolve(filePath)

    // Normalise volume per platform
    const volForOs =
      process.platform === 'darwin' ? Math.min(2, volume * 2) : volume

    // Build the command + args array
    const [cmd, ...args] =
      process.platform === 'darwin'
        ? macPlayCommand(absolutePath, volForOs)
        : windowsPlayCommand(absolutePath, volForOs)

    // Spawn the child – we **do not** use stdio: 'ignore' because on Windows
    // PowerShell may emit some warning messages that would otherwise cause the
    // process to block if the pipe buffers fill up.
    const child = spawn(cmd, args, {
      detached: false,
      windowsHide: true,
    })

    // Create an id and store it so we can kill later
    const id = makeId()
    activeChildren.set(id, child)

    // When the child exits (finished playing or killed) clean up the map.
    child.on('exit', () => activeChildren.delete(id))
    child.on('error', () => activeChildren.delete(id))

    return id
  },

  /**
   * Stop playback that was started with `play()`.
   *
   * @param {string} id The playback‑id returned by `play()`.
   * @returns {boolean} `true` if a process was found and killed, otherwise `false`.
   */
  stop(id) {
    const child = activeChildren.get(id)
    if (!child) return false

    // On POSIX we can send SIGTERM (default). On Windows the same call
    // translates to TerminateProcess which is sufficient for our short‑lived
    // PowerShell script.
    child.kill() // default signal = 'SIGTERM'

    // Clean up immediately – the `exit` listener will also remove it, but we
    // do it now so subsequent calls return false.
    activeChildren.delete(id)
    return true
  },

  /**
   * Convenience: stop **all** currently playing sounds.
   */
  stopAll() {
    for (const id of Array.from(activeChildren.keys())) {
      this.stop(id)
    }
  },
}
