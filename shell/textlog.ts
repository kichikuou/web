// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$} from './util.js';

const textLogMaxLines = 2000;

// Ignore mouse wheel events on the game canvas up to this timestamp.
let wheelIgnoreTime = 0;

// Text from these scenario pages won't be shown in the text log.
const suppressionTable: [RegExp | string, string][] = [
    ['ＲＡＮＣＥ', '2'],
    ['ＲＡＮＣＥ２', '2'],
    ['Ｒａｎｃｅ３', '1'],
    [/^(Ｒａｎｃｅ４　－教団の遺産－　Ｆｏｒ　Ｗｉｎ９５|Rance4 -Legacy of the Sect- For Win95|RanceⅣ　－教団の遺産－　for Windows|Rance4 -Legacy of the Sect- for Windows)$/,
     '10,11,16,88,90,98'],
    ['ランス 4.1 〜お薬工場を救え！〜', '6'],
    ['ランス 4.2 〜エンジェル組〜', '7'],
    ['Rance4.1 for System3.9', '2,7'],
    ['Rance4.2 for System3.9', '2,8'],
    [/^(鬼畜王ランス|Kichikuou Rance)$/, '7,11,15,16,17,18,23,24,32,33,197'],
    ['闘神都市', '1'],
    ['闘神都市Ⅱ　ｆｏｒ　Ｗｉｎ９５', '4,5,6,7,8'],
    ['あゆみちゃん物語', '6'],
    [/^グレイメルカ ver1\./, '1,2,5,6'],
];

const dialog = $('#textlog') as HTMLDialogElement;
const textlogContent = $('#textlog-content');

function init() {
    $('#textlog-button').addEventListener('click', openTextLog);
    $('#textlog-close').addEventListener('click', () => dialog.close());
    // Close the dialog when clicked outside of the dialog.
    dialog.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', onDialogClose);
    for (const e of Array.from(dialog.children))
        e.addEventListener('click', (e) => e.stopPropagation());
}

document.addEventListener('gamestart', () => {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.keyCode === 76) { // l
            openTextLog();
        }
    });
});

$('#canvas').addEventListener('wheel', (e: WheelEvent) => {
    // Do not open text log if the game is actively checking mouse wheel state.
    if (performance.now() < wheelIgnoreTime) {
        return;
    }
    if (e.deltaY <= 0) {
        openTextLog();
    }
});

textlogContent.addEventListener('wheel', (e: WheelEvent) => {
    if (e.deltaY > 0 && textlogContent.scrollTop + textlogContent.clientHeight >= textlogContent.scrollHeight) {
        dialog.close();
    }
});

function openTextLog() {
    if (dialog.open) {
        return;
    }
    render(textlogContent);
    dialog.appendChild($('#toast-container'));  // Make toasts appear over the dialog
    dialog.showModal();
    textlogContent.scrollTop = textlogContent.scrollHeight;
}

function onDialogClose() {
    document.body.appendChild($('#toast-container'));
}

let linebuf = '';
let lines: string[] = [];

export function message(s: string) {
    linebuf += s;
}

export function newline() {
    if (linebuf !== '') {
        addLine(linebuf);
        linebuf = '';
    }
}

export function nextpage() {
    newline();
    if (lines[lines.length - 1] !== '') {
        addLine('');
    }
}

export function keywait() {
    newline();
}

function render(e: HTMLElement) {
    e.textContent = lines.join('\n');
}

export function setTitle(title: string) {
    for (const [pattern, list] of suppressionTable) {
        if (pattern instanceof RegExp ? pattern.test(title) : pattern === title) {
            const ptr = Module!.stringToUTF8OnStack(list);
            Module!._texthook_set_suppression_list(ptr);
            return;
        }
    }
}

function addLine(s: string) {
    lines.push(s);
    if (lines.length > textLogMaxLines)
        lines.shift();
}

export function disableWheelEvent(duration: number) {
    wheelIgnoreTime = performance.now() + duration;
}

init();
