namespace xsystem35 {
    const major = 240;
    let entryCount = 0;

    type PatchTable = [number, number, number][]; // addr, old, new

    // See xsystem35-sdl2/patch/README.TXT
    const PastelChimePatch: PatchTable = [
        [0x1c68, 0x54, 0x47]
    ];

    const TADAModePatch: PatchTable = [
        [0x0087b, 0x40, 0x41],
        [0x01b79, 0x40, 0x41],
        [0x16e5f, 0x24, 0x40],
        [0x16e60, 0xae, 0x92],
        [0x16e61, 0x06, 0x05]
    ];

    export function registerDataFile(fname: string, size: number, chunks: Uint8Array[]) {
        let dev = FS.makedev(major, entryCount++);
        let ops = new NodeOps(size, chunks);
        FS.registerDevice(dev, ops);
        FS.mkdev('/' + fname, dev);

        switch (fname.toUpperCase()) {
        case 'ぱすてるSA.ALD':
            ops.patch(PastelChimePatch);
            break;
        case '鬼畜王SA.ALD':
            if (urlParams.get('tada') === '1')
                ops.patch(TADAModePatch);
            break;
        }
    }

    class NodeOps {
        private addr: number;

        constructor(private size: number, chunks: Uint8Array[]) {
            let ptr = this.addr = Module.getMemory(size);
            for (let c of chunks) {
                Module.HEAPU8.set(c, ptr);
                ptr += c.byteLength;
            }
        }

        read(stream: any, buffer: Int8Array, offset: number, length: number, position: number): number {
            let src = this.addr + position;
            length = Math.min(length, this.size - position);
            buffer.set(Module.HEAPU8.subarray(src, src + length), offset);
            return length;
        }

        llseek(stream: any, offset: number, whence: number): number {
            let position = offset;
            if (whence === 1)  // SEEK_CUR
                position += stream.position;
            else if (whence === 2)  // SEEK_END
                position += this.size;
            return position;
        }

        mmap() {
            return { ptr: this.addr, allocated: false };
        }

        patch(table: PatchTable) {
            for (let a of table) {
                if (Module.HEAPU8[this.addr + a[0]] !== a[1]) {
                    console.log('Patch failed');
                    return;
                }
            }
            for (let a of table)
                Module.HEAPU8[this.addr + a[0]] = a[2];
            console.log('Patch applied');
        }
    }
}
