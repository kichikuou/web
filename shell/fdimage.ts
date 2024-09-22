import * as FatFs from "js-fatfs";
import SevenZipFactory from "7z-wasm";

class RawDiskImage implements FatFs.DiskIO {
	private sectorSize: number;

	constructor(private image: Uint8Array) {
        const view = new DataView(image.buffer);
		this.sectorSize = view.getUint16(11, true);  // BPB_BytsPerSec
	}
	initialize(ff: FatFs.FatFs, pdrv: number) {
		return 0;
	}
	status(ff: FatFs.FatFs, pdrv: number) {
		return 0;
	}
	read(ff: FatFs.FatFs, pdrv: number, buff: number, sector: number, count: number) {
		const data = this.image.subarray(sector * this.sectorSize, (sector + count) * this.sectorSize);
		ff.HEAPU8.set(data, buff);

        // A hack to make FatFs recognize PC98 disks.
        if (sector === 0 && count === 1) {
            // Boot signature
            ff.HEAPU8[buff + 510] = 0x55;
            ff.HEAPU8[buff + 511] = 0xAA;
        }
		return FatFs.RES_OK;
	}
	write(ff: FatFs.FatFs, pdrv: number, buff: number, sector: number, count: number) {
		return FatFs.RES_ERROR;
	}
	ioctl(ff: FatFs.FatFs, pdrv: number, cmd: number, buff: number) {
		switch (cmd) {
			case FatFs.GET_SECTOR_COUNT:
				ff.setValue(buff, this.image.byteLength / this.sectorSize, 'i32');
				return FatFs.RES_OK;
			case FatFs.GET_SECTOR_SIZE:
				ff.setValue(buff, this.sectorSize, 'i16');
				return FatFs.RES_OK;
			case FatFs.GET_BLOCK_SIZE:
				ff.setValue(buff, 1, 'i32');
				return FatFs.RES_OK;
			default:
				console.warn(`ioctl(${cmd}): not implemented`);
				return FatFs.RES_ERROR;
		}
	}
}

function check_result(r: number) {
    if (r !== FatFs.FR_OK) throw new Error(`FatFs error: ${r}`);
}

function readFile(ff: FatFs.FatFs, path: string): Uint8Array {
	const fp = ff.malloc(FatFs.sizeof_FIL);
	check_result(ff.f_open(fp, path, FatFs.FA_READ));
	const size = ff.f_size(fp);
	const buf = ff.malloc(size);
	const br = ff.malloc(4);
	check_result(ff.f_read(fp, buf, size, br));
    if (ff.getValue(br, 'i32') !== size) {
        throw new Error(`f_read: unexpected read size (${size} expected, got ${ff.getValue(br, 'i32')})`);
    }
	ff.free(br);
	const result = ff.HEAPU8.slice(buf, buf + size);
	ff.free(buf);
	check_result(ff.f_close(fp));
	ff.free(fp);
	return result;
}

export type ExtractCallback = (fname: string, contents: Uint8Array) => void;

export async function extractFDImage(image: Uint8Array, callback: ExtractCallback) {
    const diskio = new RawDiskImage(image);
    const ff = await FatFs.create({ diskio, codepage: 932 });

    const fs = ff.malloc(FatFs.sizeof_FATFS);
    check_result(ff.f_mount(fs, '', 1));

    const dp = ff.malloc(FatFs.sizeof_DIR);
    const fno = ff.malloc(FatFs.sizeof_FILINFO);
    check_result(ff.f_opendir(dp, '/'));
    while (true) {
        check_result(ff.f_readdir(dp, fno));
        const fname = ff.FILINFO_fname(fno);
        if (fname === '') break;
        if (ff.FILINFO_fattrib(fno) & FatFs.AM_DIR) {
            console.log(`ignoring directory ${fname}`)
        } else if (fname.endsWith('.LZH')) {
            await extractArchive(fname, readFile(ff, fname), callback);
        } else {
            callback(fname, readFile(ff, fname));
        }
    }
}

async function extractArchive(fname: string, contents: Uint8Array, callback: ExtractCallback) {
    const sevenZip = await SevenZipFactory({
        print: (s: string) => {}
    });
    sevenZip.FS.mkdir('/archive');
    const archiveName = '/archive/' + fname;
    sevenZip.FS.writeFile(archiveName, contents);
    sevenZip.FS.mkdir('/out');
    sevenZip.callMain([
        'e', '-o/out',  // Extract to /out
        '-aos',         // Skip extracting of existing files
        '-bsp0',        // Disable progress output
        archiveName,
    ]);
    for (const fname of sevenZip.FS.readdir('/out')) {
        if (fname === '.' || fname === '..') {
            continue;
        }
        const path = '/out/' + fname;
        if (sevenZip.FS.isDir(sevenZip.FS.stat(path).mode)) {
            console.log(`ignoring directory ${fname}`)
            continue;
        }
        const content = sevenZip.FS.readFile(path);
        callback(fname, content);
    }
}
