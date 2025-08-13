type PlaybackId = string;
interface PlayResult {
    /** The id you can later pass to `stop()` or `stopAll()`. */
    id: PlaybackId;
    /**
     * A promise that resolves **when the sound finishes playing** (or is killed).
     * It never rejects – if the process errors it still resolves after cleanup.
     */
    finished: Promise<void>;
}
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
export declare function play(filePath: string, volume?: number): PlayResult;
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
