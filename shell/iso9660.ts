// Copyright (c) 2024 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { Reader } from './cdimage.js';

export class FileSystem {
    private decoder: TextDecoder;

    static async create(sectorReader: Reader): Promise<FileSystem> {
        let best_vd: VolumeDescriptor | null = null;
        for (let sector = 0x10;; sector++) {
            let vd = new VolumeDescriptor(await sectorReader.readSector(sector));
            switch (vd.type) {
            case VDType.Primary:
                if (!best_vd)
                    best_vd = vd;
                break;
            case VDType.Supplementary:
                if (vd.encoding())
                    best_vd = vd;
                break;
            case VDType.Terminator:
                if (!best_vd)
                    throw new Error('PVD not found');
                return new FileSystem(sectorReader, best_vd);
            }
        }
    }

    private constructor(private sectorReader: Reader, private vd: VolumeDescriptor) {
        this.decoder = new TextDecoder(vd.encoding());
    }

    volumeLabel(): string {
        return this.vd.volumeLabel(this.decoder);
    }

    rootDir(): DirEnt {
        return this.vd.rootDirEnt(this.decoder);
    }

    async getDirEnt(name: string, parent: DirEnt): Promise<DirEnt | null> {
        name = name.toLowerCase();
        for (let e of await this.readDir(parent)) {
            if (e.name.toLowerCase() === name)
                return e;
        }
        return null;
    }

    async readDir(dirent: DirEnt): Promise<DirEnt[]> {
        let sector = dirent.sector;
        let position = 0;
        let length = dirent.size;
        let entries: DirEnt[] = [];
        let buf: ArrayBuffer;
        while (position < length) {
            if (position === 0)
                buf = await this.sectorReader.readSector(sector);
            let child = new DirEnt(buf!, position, this.decoder);
            if (child.length === 0) {
                // Padded end of sector
                position = 2048;
            } else {
                entries.push(child);
                position += child.length;
            }
            if (position > 2048)
                throw new Error('dirent across sector boundary');
            if (position === 2048) {
                sector++;
                position = 0;
                length -= 2048;
            }
        }
        return entries;
    }

    readFile(dirent: DirEnt): Promise<Uint8Array[]> {
        return this.sectorReader.readSequentialSectors(dirent.sector, dirent.size);
    }
}

enum VDType {
    Primary = 1,
    Supplementary = 2,
    Terminator = 255
}

class VolumeDescriptor {
    private view: DataView;
    constructor(private buf: ArrayBuffer) {
        this.view = new DataView(buf);
        if (ASCIIArrayToString(new Uint8Array(this.buf, 1, 5)) !== 'CD001')
            throw new Error('Not a valid CD image');
    }
    get type(): number {
        return this.view.getUint8(0);
    }
    volumeLabel(decoder: TextDecoder): string {
        return decoder.decode(new DataView(this.buf, 40, 32)).trim();
    }
    encoding(): string | undefined {
        if (this.type === VDType.Primary)
            return 'shift_jis';
        if (this.escapeSequence().match(/%\/[@CE]/))
            return 'utf-16be';  // Joliet
        return undefined;
    }
    escapeSequence(): string {
        return ASCIIArrayToString(new Uint8Array(this.buf, 88, 32)).trim();
    }
    rootDirEnt(decoder: TextDecoder): DirEnt {
        return new DirEnt(this.buf, 156, decoder);
    }
}

export class DirEnt {
    private view: DataView;
    constructor(private buf: ArrayBuffer, private offset: number, private decoder: TextDecoder) {
        this.view = new DataView(buf, offset);
    }
    get length(): number {
        return this.view.getUint8(0);
    }
    get sector(): number {
        return this.view.getUint32(2, true);
    }
    get size(): number {
        return this.view.getUint32(10, true);
    }
    get isDirectory(): boolean {
        return (this.view.getUint8(25) & 2) !== 0;
    }
    get name(): string {
        let len = this.view.getUint8(32);
        let name = new DataView(this.buf, this.offset + 33, len)
        if (len === 1) {
            switch (name.getUint8(0)) {
            case 0:
                return '.';
            case 1:
                return '..';
            }
        }
        return this.decoder.decode(name).split(';')[0];
    }
}

function ASCIIArrayToString(buffer: Uint8Array): string {
    return String.fromCharCode.apply(null, buffer as any);
}
