const { exec } = require('child_process');
const execPromise = require('util').promisify(exec);

// Functionality to give caller the ability to stop playing
function execWithChild(command, options = {}) {
  let child;
  const promise = new Promise((resolve, reject) => {
    child = exec(command, { ...options, detached: true }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout);
    });
  });

const originalKill = child.kill.bind(child);
  child.kill = (signal = 'SIGTERM') => {
    try {
      // A negative PID tells Node to signal the entire process group.
      process.kill(-child.pid, signal);
    } catch (_) {
      // If that fails for any reason fall back to killing just the shell.
      originalKill(signal);
    }
  };

  return { promise, child };}

/* MAC PLAY COMMAND */
const macPlayCommand = (path, volume, rate) => `afplay \"${path}\" -v ${volume} -r ${rate}`;

/* WINDOW PLAY COMMANDS */
const addPresentationCore = `Add-Type -AssemblyName presentationCore;`;
const createMediaPlayer = `$player = New-Object system.windows.media.mediaplayer;`;
const loadAudioFile = path => `$player.open('${path}');`;
const playAudio = `$player.Play();`;
const stopAudio = `Start-Sleep 1; Start-Sleep -s $player.NaturalDuration.TimeSpan.TotalSeconds;Exit;`;

const windowPlayCommand = (path, volume) =>
  `powershell -c ${addPresentationCore} ${createMediaPlayer} ${loadAudioFile(
    path,
  )} $player.Volume = ${volume}; ${playAudio} ${stopAudio}`;

/**
 * Plays an audio file on Mac or Windows
 *
 * @param {string} path - The file path to the audio file that will be played.
 * @param {number} [volume=0.5] - Playback volume as a decimal between 0 and 1.
 *  - Windows: Volume range is 0 to 1. Default is 0.5.
 *  - Mac: Volume range is scaled from 0 to 2 (where 2 is 100% volume). Values above 2 may cause distortion.
 * @param {number} [rate=1] - Playback rate multiplier (only used on Mac). 1 is normal speed.
 * 
 * @throws Will throw an error if audio playback fails.
 */
module.exports = {
  player: (path, volume=0.5, rate=1) => {
    const volumeAdjustedByOS = process.platform === 'darwin' ? Math.min(2, volume * 2) : volume;

    const playCommand =
      process.platform === 'darwin'
      ? macPlayCommand(path, volumeAdjustedByOS, rate)
      : windowPlayCommand(path, volumeAdjustedByOS);

    const { promise, child } = execWithChild(playCommand, { windowsHide: true });
    
    return {
      stop: () => child.kill(),
      play: async () => {
        try {
          const result = await promise;
          return result;
        } catch (error) {
          throw error;
        }
      },
      process: child
    };
  }
};
