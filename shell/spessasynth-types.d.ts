export class Synthetizer {
    constructor(targetNode: AudioNode, soundFontBuffer: ArrayBuffer, enableEventSystem?: boolean, startRenderingData?: any, synthConfig?: any);
}

type MIDIFile = { binary: Uint8Array, altName?: string };

export class Sequencer {
    constructor(midiBinaries: MIDIFile[], synth: Synthetizer, options?: any);
    loop: boolean;
    currentTime: number;
    isFinished: boolean;
    pause(): void;
    play(): void;
    stop(): void;
    loadNewSongList(midiBuffers: MIDIFile[]): void;
}
