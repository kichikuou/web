"use strict";
importScripts('lame.js');
let lameModule;
const MAX_SAMPLES = 256 * 1024;
const PCM_BUF_SIZE = MAX_SAMPLES * 4;
const BUF_SIZE = MAX_SAMPLES * 1.25 + 7200;
const vbr_default = 4; // from lame.h
const VBR_QUALITY = 5;
const WAVE_HEADER_SIZE = 44;
class Lame {
    constructor(module) {
        this.module = module;
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
    encode(samples) {
        const numSamples = samples.length / 2;
        const outputChunks = [];
        let chunkStart = 0;
        while (chunkStart < numSamples) {
            const chunkEnd = Math.min(chunkStart + MAX_SAMPLES, numSamples);
            this.pcmBuffer.set(samples.slice(chunkStart * 2, chunkEnd * 2));
            const n = this.module._lame_encode_buffer_interleaved(this.gfp, this.pcmBuffer.byteOffset, chunkEnd - chunkStart, this.outputBuffer.byteOffset, BUF_SIZE);
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
    free() {
        this.module._free(this.pcmBuffer.byteOffset);
        this.module._free(this.outputBuffer.byteOffset);
        this.module._lame_close(this.gfp);
    }
}
async function encode(track, data) {
    if (!lameModule)
        lameModule = await Module();
    const lame = new Lame(lameModule);
    const samples = new Int16Array(data, WAVE_HEADER_SIZE);
    const start = performance.now();
    const mp3data = lame.encode(samples);
    lame.free();
    const time = performance.now() - start;
    self.postMessage({ track, time, data: mp3data }, mp3data);
}
onmessage = (e) => {
    const { track, data } = e.data;
    encode(track, data);
};
