// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, urlParams } from './util.js';
const textLogMaxLines = 2000;
// Text from these scenario pages won't be shown in the text log.
const quietPagesTable = {
    'ＲＡＮＣＥ': [2],
    'ＲＡＮＣＥ２': [2],
    'Ｒａｎｃｅ３': [1],
    'Ｒａｎｃｅ４　－教団の遺産－　Ｆｏｒ　Ｗｉｎ９５': [10, 11, 16, 88, 90],
    'Rance4 -Legacy of the Sect- For Win95': [10, 11, 16, 88, 90],
    'ランス 4.1 〜お薬工場を救え！〜': [6],
    'ランス 4.2 〜エンジェル組〜': [7],
    '鬼畜王ランス': [7, 11, 15, 16, 17, 18, 23, 24, 32, 33, 197],
    'Kichikuou Rance': [7, 11, 15, 16, 17, 18, 23, 24, 32, 33, 197],
    '闘神都市': [1],
    '闘神都市Ⅱ　ｆｏｒ　Ｗｉｎ９５': [4, 5, 6, 7, 8],
    'あゆみちゃん物語': [6],
};
const textlogContent = $('#textlog-content');
$('#textlog-button').addEventListener('click', openTextLog);
$('#textlog-close').addEventListener('click', closeTextLog);
$('#textlog-overlay').addEventListener('click', closeTextLog);
document.addEventListener('gamestart', () => {
    document.addEventListener('keydown', (e) => {
        if (e.keyCode === 76) { // l
            openTextLog();
        }
        else if (e.keyCode === 27) { // esc
            closeTextLog();
        }
    });
});
$('#canvas').addEventListener('wheel', (e) => {
    if (e.deltaY <= 0) {
        openTextLog();
    }
});
textlogContent.addEventListener('wheel', (e) => {
    if (e.deltaY > 0 && textlogContent.scrollTop + textlogContent.clientHeight >= textlogContent.scrollHeight) {
        closeTextLog();
    }
});
function openTextLog() {
    const classes = $('#textlog-modal').classList;
    if (classes.contains('active')) {
        return;
    }
    render(textlogContent);
    classes.add('active');
    textlogContent.scrollTop = textlogContent.scrollHeight;
}
function closeTextLog() {
    $('#textlog-modal').classList.remove('active');
}
let currentPage = -1;
let linebuf = '';
let lines = [];
let quietPages = [];
let consoleLog = urlParams.get('consoleTextLog') === '1';
export function message(s, page) {
    if (linebuf === '')
        currentPage = page;
    linebuf += s;
}
export function newline() {
    if (linebuf !== '') {
        if (!skiplog(currentPage)) {
            if (consoleLog)
                console.log(currentPage + ': ' + linebuf);
            addLine(linebuf);
        }
        linebuf = '';
    }
}
export function nextpage() {
    newline();
    if (lines[lines.length - 1] !== '') {
        if (consoleLog)
            console.log('');
        addLine('');
    }
}
export function keywait() {
    newline();
}
function render(e) {
    e.textContent = lines.join('\n');
}
export function setTitle(title) {
    quietPages = quietPagesTable[title] || [];
}
function addLine(s) {
    lines.push(s);
    if (lines.length > textLogMaxLines)
        lines.shift();
}
function skiplog(page) {
    return quietPages.includes(page);
}
