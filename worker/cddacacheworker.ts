importScripts('lame.js');

type Ptr = number;
interface LameModule extends EmscriptenModule {
    _lame_init(): Ptr;
    _lame_set_mode(gfp: Ptr, mode: number): number;
    _lame_set_num_channels(gfp: Ptr, channels: number): number;
    _lame_set_in_samplerate(gfp: Ptr, rate: number): number;
    _lame_set_VBR(gfp: Ptr, vbr_mode: number): number;
    _lame_set_VBR_q(gfp: Ptr, quality: number): number;
    _lame_init_params(gfp: Ptr): number;
    _lame_encode_buffer_interleaved(gfp: Ptr, pcm: Ptr, num_samples: number, mp3buf: Ptr, mp3buf_size: number): number;
    _lame_encode_flush(gfp: Ptr, mp3buf: Ptr, size: number): number;
    _lame_close(gfp: Ptr): number;
}
declare var Module: EmscriptenModuleFactory<LameModule>;

let lameModule: LameModule | undefined;

const MAX_SAMPLES = 256*1024;
const PCM_BUF_SIZE = MAX_SAMPLES * 4;
const BUF_SIZE = MAX_SAMPLES * 1.25 + 7200;
const vbr_default = 4;  // from lame.h
const VBR_QUALITY = 5;
const WAVE_HEADER_SIZE = 44;

class Lame {
    private readonly gfp: Ptr;
    private readonly pcmBuffer: Int16Array;
    private readonly outputBuffer: Uint8Array;

    constructor(private module: LameModule) {
        this.gfp = module._lame_init();
        if (!this.gfp)
            throw new Error('lame_init failed');
        module._lame_set_num_channels(this.gfp, 2);
        module._lame_set_in_samplerate(this.gfp, 44100);
        module._lame_set_VBR(this.gfp, vbr_default);
        module._lame_set_VBR_q(this.gfp, VBR_QUALITY);
        const r = module._lame_init_params(this.gfp);
        if (r < 0)
            throw new Error('lame_init_params failed: ' + r);

        const memoryBuffer = module.HEAP8.buffer;
        this.pcmBuffer = new Int16Array(memoryBuffer, module._malloc(PCM_BUF_SIZE));
        this.outputBuffer = new Uint8Array(memoryBuffer, module._malloc(BUF_SIZE));
    }

    public encode(samples: Int16Array): ArrayBufferLike[] {
        const numSamples = samples.length / 2;
        const outputChunks: ArrayBufferLike[] = [];
        let chunkStart = 0;
        while (chunkStart < numSamples) {
            const chunkEnd = Math.min(chunkStart + MAX_SAMPLES, numSamples);
            this.pcmBuffer.set(samples.slice(chunkStart * 2, chunkEnd * 2));
            const n = this.module._lame_encode_buffer_interleaved(
                this.gfp,
                this.pcmBuffer.byteOffset, chunkEnd - chunkStart,
                this.outputBuffer.byteOffset, BUF_SIZE);
            if (n < 0)
                throw new Error("lame_encode_buffer_interleaved failed: " + n);
            outputChunks.push(this.outputBuffer.slice(0, n).buffer);
            chunkStart = chunkEnd;
        }
        const n = this.module._lame_encode_flush(this.gfp, this.outputBuffer.byteOffset, BUF_SIZE);
        if (n < 0)
            throw new Error("lame_encode_flush failed: " + n);
        outputChunks.push(this.outputBuffer.slice(0, n).buffer);
        return outputChunks;
    }

    public free() {
        this.module._free(this.pcmBuffer.byteOffset);
        this.module._free(this.outputBuffer.byteOffset);
        this.module._lame_close(this.gfp);
    }
}

async function encode(track: number, data: ArrayBuffer) {
    if (!lameModule)
        lameModule = await Module();
    const lame = new Lame(lameModule);
    const samples = new Int16Array(data, WAVE_HEADER_SIZE);
    const start = performance.now();
    const mp3data = lame.encode(samples);
    lame.free();
    const time = performance.now() - start;
    self.postMessage({track, time, data: mp3data}, mp3data);
}

onmessage = (e: MessageEvent) => {
    const {track, data} = e.data as {track: number, data: ArrayBuffer};
    encode(track, data);
}
