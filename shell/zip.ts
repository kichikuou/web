// Copyright (c) 2024 Kichikuou <KichikuouChrome@gmail.com>
// Licensed under the MIT License. See the LICENSE file for details.

const GPBF_ENCRYPTED = 0x0001;
const GPBF_UTF8 = 0x0800;
const OS_UNIX = 3;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const DOS_ATTR_DIRECTORY = 0x10;
const DOS_ATTR_ARCHIVE = 0x20;

class ZipError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'ZipError';
    }
}

export class ZipFile {
    name: string;
    fileOffset: number;
    compressedSize: number;
    uncompressedSize: number;
    crc32: number;
    method: number;
    gpbf: number;

    isEncrypted(): boolean {
        return (this.gpbf & GPBF_ENCRYPTED) !== 0;
    }

    constructor(private file: Blob, cde: Uint8Array) {
        const v = new DataView(cde.buffer, cde.byteOffset, cde.byteLength);
        if (v.getUint32(0, true) !== 0x02014B50) {  // "PK\001\002"
            throw new ZipError('Invalid central directory');
        }
        const versionMadeBy = v.getUint16(4, true);
        const versionNeeded = v.getUint16(6, true);
        if (versionNeeded > 20) throw new ZipError('Unsupported ZIP version: ' + versionNeeded);
        this.gpbf = v.getUint16(8, true);
        this.method = v.getUint16(10, true);
        this.crc32 = v.getInt32(16, true);
        this.compressedSize = v.getUint32(20, true);
        this.uncompressedSize = v.getUint32(24, true);
        const fileNameLength = v.getUint16(28, true);
        this.fileOffset = v.getUint32(42, true);
        const fileNameBytes = cde.subarray(46, 46 + fileNameLength);
        const encoding = this.guessPathEncoding(versionMadeBy);
        try {
            this.name = new TextDecoder(encoding, { fatal: true }).decode(fileNameBytes);
        } catch (e) {
            if (e instanceof TypeError) {
                let name = '';
                for (let i = 0; i < fileNameBytes.length; i++) {
                    let c = fileNameBytes[i];
                    if (0x20 <= c && c < 0x80) {
                        name += String.fromCharCode(c);
                    } else {
                        name += '%' + c.toString(16).toUpperCase().padStart(2, '0');
                    }
                }
                throw new ZipError(`Failed to decode file name: ${name}`);
            } else {
                throw e;
            }
        }
    }

    guessPathEncoding(versionMadeBy: number): string {
        if (this.gpbf & GPBF_UTF8) return 'utf-8';
        const os = versionMadeBy >> 8;
        if (os === OS_UNIX) return 'utf-8';
        return 'shift_jis';
    }

    async compressedData(): Promise<Blob> {
        const localHeader = await readBytes(this.file, this.fileOffset, 30);
        const lhView = new DataView(localHeader);
        if (lhView.getUint32(0, true) !== 0x04034B50) {  // "PK\003\004"
            throw new ZipError('Invalid local header');
        }
        const compressedDataOffset = this.fileOffset + 30 + lhView.getUint16(26, true) + lhView.getUint16(28, true);
        return this.file.slice(compressedDataOffset, compressedDataOffset + this.compressedSize);
    }

    async extract(): Promise<Uint8Array> {
        if (this.isEncrypted()) throw new ZipError('Encrypted ZIP files are not supported');
        if (this.method === METHOD_STORE) {
            return new Uint8Array(await (await this.compressedData()).arrayBuffer());
        }
        if (this.method !== METHOD_DEFLATE) throw new ZipError('Unsupported compression method: ' + this.method);
        const stream = (await this.compressedData()).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const data = await new Response(stream).arrayBuffer();
        if (~crc32(new Uint8Array(data)) !== this.crc32) {
            throw new ZipError('CRC32 mismatch');
        }
        return new Uint8Array(data);
    }
}

export async function load(file: Blob): Promise<ZipFile[]> {
    // Find the OECD record.
    const oecdBuf = await readBytes(file, Math.max(0, file.size - 65558), Math.min(65558, file.size));
    const view = new DataView(oecdBuf);
    let oecdp = oecdBuf.byteLength - 22;
    while (oecdp >= 0) {
        if (view.getUint32(oecdp, true) === 0x06054B50) {  // "PK\005\006"
            break;
        }
        oecdp--;
    }
    if (oecdp < 0) throw new ZipError('Not a ZIP file');

    // Read the central directory.
    const cdSize = view.getUint32(oecdp + 12, true);
    const cdOffset = view.getUint32(oecdp + 16, true);
    const cdBuf = await readBytes(file, cdOffset, cdSize);
    const cdView = new DataView(cdBuf);
    let pos = 0;
    const files: ZipFile[] = [];
    while (pos < cdSize) {
        const fileNameLength = cdView.getUint16(pos + 28, true);
        const extraFieldLength = cdView.getUint16(pos + 30, true);
        const commentLength = cdView.getUint16(pos + 32, true);
        const cdeSize = 46 + fileNameLength + extraFieldLength + commentLength;
        files.push(new ZipFile(file, new Uint8Array(cdBuf, pos, cdeSize)));
        pos += cdeSize;
    }
    return files;
}

export class ZipBuilder {
    private entries: Uint8Array[] = [];
    private centralDirectory: Uint8Array[] = [];
    private offset = 0;

    addFile(path: string, data: Uint8Array, mtime: Date) {
        const dosTime = (mtime.getSeconds() >> 1) | (mtime.getMinutes() << 5) | (mtime.getHours() << 11);
        const dosDate = mtime.getDate() | ((mtime.getMonth() + 1) << 5) | ((mtime.getFullYear() - 1980) << 9);
        const crc = ~crc32(data);
        const nameIsAscii = /^[\x20-\x7E]*$/.test(path);
        const name = new TextEncoder().encode(path);
        const nameLength = name.byteLength;
        const gpbf = nameIsAscii ? 0 : GPBF_UTF8;
        const extAttr = path.endsWith('/') ? DOS_ATTR_DIRECTORY : DOS_ATTR_ARCHIVE;

        const localHeader = new Uint8Array(30 + nameLength);
        const lh = new DataView(localHeader.buffer);
        lh.setUint32(0, 0x04034B50, true);  // "PK\003\004"
        lh.setUint16(4, 20, true);  // version needed to extract
        lh.setUint16(6, gpbf, true);  // GPB flag
        lh.setUint16(8, METHOD_STORE, true);  // compression method
        lh.setUint16(10, dosTime, true);
        lh.setUint16(12, dosDate, true);
        lh.setUint32(14, crc, true);
        lh.setUint32(18, data.byteLength, true);  // compressed size
        lh.setUint32(22, data.byteLength, true);  // uncompressed size
        lh.setUint16(26, nameLength, true);  // file name length
        lh.setUint16(28, 0, true);  // extra field length
        localHeader.set(name, 30);
        this.entries.push(localHeader, data);

        const centralDirectoryEntry = new Uint8Array(46 + nameLength);
        const cde = new DataView(centralDirectoryEntry.buffer);
        cde.setUint32(0, 0x02014B50, true);  // "PK\001\002"
        cde.setUint16(4, OS_UNIX << 8 | 20, true);  // version made by
        cde.setUint16(6, 20, true);  // version needed to extract
        cde.setUint16(8, gpbf, true);  // GPB flag
        cde.setUint16(10, METHOD_STORE, true);  // compression method
        cde.setUint16(12, dosTime, true);
        cde.setUint16(14, dosDate, true);
        cde.setUint32(16, crc, true);
        cde.setUint32(20, data.byteLength, true);  // compressed size
        cde.setUint32(24, data.byteLength, true);  // uncompressed size
        cde.setUint16(28, nameLength, true);  // file name length
        cde.setUint16(30, 0, true);  // extra field length
        cde.setUint16(32, 0, true);  // comment length
        cde.setUint16(34, 0, true);  // disk number start
        cde.setUint16(36, 0, true);  // internal file attributes
        cde.setUint32(38, extAttr, true);  // external file attributes
        cde.setUint32(42, this.offset, true);  // local header offset
        centralDirectoryEntry.set(name, 46);
        this.centralDirectory.push(centralDirectoryEntry);

        this.offset += localHeader.byteLength + data.byteLength;
    }

    addDir(path: string, mtime: Date) {
        this.addFile(path + '/', new Uint8Array(0), mtime);
    }

    build(): Blob {
        const centralDirectorySize = this.centralDirectory.reduce((sum, e) => sum + e.byteLength, 0);
        const eocd = new Uint8Array(22);
        const v = new DataView(eocd.buffer);
        v.setUint32(0, 0x06054B50, true);  // "PK\005\006"
        v.setUint16(8, this.centralDirectory.length, true);
        v.setUint16(10, this.centralDirectory.length, true);
        v.setUint32(12, centralDirectorySize, true);
        v.setUint32(16, this.offset, true);
        return new Blob([...this.entries, ...this.centralDirectory, eocd], { type: 'application/zip' });
    }
}

const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
    crc32Table[i] = crc;
}

export function crc32(data: Uint8Array, crc: number = -1): number {
    for (let i = 0; i < data.length; i++) {
        crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return crc;
}

function readBytes(file: Blob, offset: number, length: number): Promise<ArrayBuffer> {
    return file.slice(offset, offset + length).arrayBuffer();
}
