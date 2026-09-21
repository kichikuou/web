// Copyright (c) 2025 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
import { config } from './config.js';
import { addToast } from './widgets.js';
import { message } from './strings.js';

import censor_list_kichikuou from '../xsystem35-sdl2/misc/censor/kichikuou.txt';
import censor_list_rance1 from '../xsystem35-sdl2/misc/censor/rance1.txt';
import censor_list_rance2 from '../xsystem35-sdl2/misc/censor/rance2.txt';
import censor_list_rance3 from '../xsystem35-sdl2/misc/censor/rance3.txt';
import censor_list_rance4 from '../xsystem35-sdl2/misc/censor/rance4.txt';

const censor_list_file = '/censor.txt';
const censorTable: [RegExp | string, string][] = [
    ['ＲＡＮＣＥ', censor_list_rance1],
    ['ＲＡＮＣＥ２', censor_list_rance2],
    ['Ｒａｎｃｅ３', censor_list_rance3],
    [/^(Ｒａｎｃｅ４　－教団の遺産－　Ｆｏｒ　Ｗｉｎ９５|Rance4 -Legacy of the Sect- For Win95|RanceⅣ　－教団の遺産－　for Windows|Rance4 -Legacy of the Sect- for Windows)$/,
     censor_list_rance4],
    [/^(鬼畜王ランス|Kichikuou Rance)$/, censor_list_kichikuou],
];

function applyCensorList() {
    const ptr = config.streamerMode ? Module!.stringToUTF8OnStack(censor_list_file) : 0;
    Module!._load_censor_list(ptr);
}

const checkbox = <HTMLInputElement>$('#streamer-mode');
checkbox.addEventListener('change', () => {
    config.streamerMode = checkbox.checked;
    config.persist();
    try {
        if (Module && Module.FS.stat(censor_list_file, undefined)) {
            applyCensorList();
        }
    } catch (e) {}
});
checkbox.checked = config.streamerMode;

function getCensorList(title: string): string | null {
    for (const [pattern, list] of censorTable) {
        if (pattern instanceof RegExp ? pattern.test(title) : pattern === title) {
            return list;
        }
    }
    return null;
}

export function setTitle(title: string) {
    const list = getCensorList(title);
    if (list) {
        checkbox.disabled = false;
        Module!.FS.writeFile(censor_list_file, list);
        if (config.streamerMode)
            setTimeout(applyCensorList, 0);  // Apply after the game engine is fully initialized
    } else {
        checkbox.disabled = true;
        if (config.streamerMode) {
            addToast(`${message.streamer_mode_not_available}`, 'warning');
        }
    }
}
