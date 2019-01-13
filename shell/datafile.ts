namespace xsystem35 {
    const major = 240;
    let entryCount = 0;

    export function registerDataFile(fname: string, size: number, chunks: Uint8Array[]) {
        let dev = FS.makedev(major, entryCount++);
        FS.registerDevice(dev, new NodeOps(size, chunks));
        FS.mkdev('/' + fname, dev);
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
    }
}
