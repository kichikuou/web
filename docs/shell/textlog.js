// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $, urlParams } from './util.js';
const textLogMaxLines = 2000;
// Text from these scenario pages won't be shown in the text log.
const quietPagesTable = {
    '鬼畜王ランス': [7, 11, 15, 16, 17, 18, 23, 24, 32, 33, 197],
    'Ｒａｎｃｅ４　－教団の遺産－　Ｆｏｒ　Ｗｉｎ９５　': [10, 11, 16, 88, 90],
    '闘神都市Ⅱ　ｆｏｒ　Ｗｉｎ９５　': [4, 5, 6, 7, 8]
};
$('#textlog-button').addEventListener('click', openTextLog);
$('#textlog-close').addEventListener('click', closeTextLog);
$('#textlog-overlay').addEventListener('click', closeTextLog);
function openTextLog() {
    let e = $('#textlog-content');
    render(e);
    $('#textlog-modal').classList.add('active');
    e.scrollTop = e.scrollHeight;
    ga('send', 'event', 'Toolbar', 'Textlog');
}
function closeTextLog() {
    $('#textlog-modal').classList.remove('active');
}
let currentPage = -1;
let linebuf = '';
let lines = [];
let quietPages = [];
let consoleLog = false;
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
    if (urlParams.get('consoleTextLog') === '1')
        consoleLog = true;
}
function addLine(s) {
    lines.push(s);
    if (lines.length > textLogMaxLines)
        lines.shift();
}
function skiplog(page) {
    return quietPages.includes(page);
}
