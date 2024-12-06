// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {urlParams} from './util.js';

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

export function registerDataFile(fname: string, chunks: Uint8Array[]) {
    const path = '/' + fname;
    var f = Module!.FS.open(path, 'w+', undefined);
    for (const chunk of chunks) {
        Module!.FS.write(f, chunk, 0, chunk.byteLength, undefined, undefined);
    }
    switch (fname.toUpperCase()) {
        case 'ぱすてるSA.ALD':
            apply_patch(f, PastelChimePatch);
            break;
        case '鬼畜王SA.ALD':
            if (urlParams.get('tada') === '1')
                apply_patch(f, TADAModePatch);
            break;
    }
    Module!.FS.close(f);
}

function apply_patch(f: any, patchTbl: PatchTable) {
    const buf = new Uint8Array(1);
    for (let a of patchTbl) {
        Module!.FS.read(f, buf, 0, 1, a[0]);
        if (buf[0] !== a[1]) {
            console.log('Patch failed');
            return;
        }
    }
    for (let a of patchTbl) {
        buf[0] = a[2];
        Module!.FS.write(f, buf, 0, 1, a[0], undefined);
    }
    console.log('Patch applied');
}
