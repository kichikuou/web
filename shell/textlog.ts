// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="util.ts" />

namespace xsystem35 {
    const textLogMaxLines = 2000;

    // Text from these scenario pages won't be shown in the text log.
    const quietPagesTable: {[key:string] : number[]} = {
        '鬼畜王ランス': [7, 11, 15, 16, 17, 18, 23, 24, 32, 33, 197],
        'Ｒａｎｃｅ４　－教団の遺産－　Ｆｏｒ　Ｗｉｎ９５　': [10, 11, 16, 88, 90],
        '闘神都市Ⅱ　ｆｏｒ　Ｗｉｎ９５　': [4, 5, 6, 7, 8]
    }

    $('#textlog-button').addEventListener('click', openTextLog);
    $('#textlog-close').addEventListener('click', closeTextLog);
    $('#textlog-overlay').addEventListener('click', closeTextLog);

    function openTextLog() {
        let e = $('#textlog-content');
        texthook.render(e);
        $('#textlog-modal').classList.add('active');
        e.scrollTop = e.scrollHeight;
        ga('send', 'event', 'Toolbar', 'Textlog');
    }

    function closeTextLog() {
        $('#textlog-modal').classList.remove('active');
    }

    class TextHook {
        private currentPage = -1;
        private linebuf = '';
        private lines: string[] = [];
        private quietPages: number[] = [];
        private consoleLog = false;

        message(s: string, page: number) {
            if (this.linebuf === '')
                this.currentPage = page;
            this.linebuf += s;
        }

        newline() {
            if (this.linebuf !== '') {
                if (!this.skiplog(this.currentPage)) {
                    if (this.consoleLog)
                        console.log(this.currentPage + ': ' + this.linebuf);
                    this.addLine(this.linebuf);
                }
                this.linebuf = '';
            }
        }

        nextpage() {
            this.newline();
            if (this.lines[this.lines.length - 1] !== '') {
                if (this.consoleLog)
                    console.log('');
                this.addLine('');
            }
        }

        keywait() {
            this.newline();
        }

        render(e: HTMLElement) {
            e.textContent = this.lines.join('\n');
        }

        setTitle(title: string) {
            this.quietPages = quietPagesTable[title] || [];
            if (urlParams.get('consoleTextLog') === '1')
                this.consoleLog = true;
        }

        private addLine(s: string) {
            this.lines.push(s);
            if (this.lines.length > textLogMaxLines)
                this.lines.shift();
        }

        private skiplog(page: number) {
            return this.quietPages.includes(page);
        }
    }
    export let texthook = new TextHook();
}
