type PlaybackId = string;
/**
 * Start playing an audio file.
 *
 * @param filePath Absolute (or relative) path to the audio file.
 * @param volume   Normalised volume (0‑1). On macOS it is scaled internally
 *                 to 0‑2 because `afplay` uses a different range.
 *
 * @returns A opaque playback‑id that can be passed to {@link stop}.
 */
export declare function play(filePath: string, volume?: number): PlaybackId;
/**
 * Stop playback that was started with {@link play}.
 *
 * @param id The playback‑id returned by {@link play}.
 * @returns `true` if a process was found and killed, otherwise `false`.
 */
export declare function stop(id: PlaybackId): boolean;
/**
 * Convenience: stop **all** currently playing sounds.
 */
export declare function stopAll(): void;
declare const _default: {
    play: typeof play;
    stop: typeof stop;
    stopAll: typeof stopAll;
};
export default _default;
