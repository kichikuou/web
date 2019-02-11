// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="loader.ts" />
/// <reference path="datafile.ts" />

namespace xsystem35 {
    export class FileLoader implements Loader {
        private tracks: File[] = [];
        public hasMidi = false;

        constructor() {
            $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
            document.body.ondragover = this.handleDragOver.bind(this);
            document.body.ondrop = this.handleDrop.bind(this);
        }

        getCDDA(track: number): Promise<Blob> {
            return Promise.resolve(this.tracks[track]);
        }

        reloadImage(): Promise<any> {
            return Promise.resolve();
        }

        private handleFileSelect(evt: Event) {
            let input = <HTMLInputElement>evt.target;
            this.startLoad(input.files);
            input.value = '';
        }

        private handleDragOver(evt: DragEvent) {
            evt.stopPropagation();
            evt.preventDefault();
            evt.dataTransfer.dropEffect = 'copy';
        }

        private handleDrop(evt: DragEvent) {
            evt.stopPropagation();
            evt.preventDefault();
            this.startLoad(evt.dataTransfer.files);
        }

        private async startLoad(files: FileList) {
            $('#loader').classList.add('module-loading');
            await shell.loadModule('xsystem35');
            let aldFiles = [];
            for (let i = 0; i < files.length; i++) {
                let f = files[i];
                let match = /(\d+)\.(wav|mp3|ogg)$/.exec(f.name.toLowerCase());
                if (match) {
                    this.tracks[Number(match[1])] = f;
                    continue;
                }
                let content = await readFileAsArrayBuffer(f);
                registerDataFile(f.name, f.size, [new Uint8Array(content)]);
                aldFiles.push(f.name);
            }
            FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
            FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
            shell.loaded();
        }

        private createGr(files: string[]): string {
            const resourceType: { [ch: string]: string } = {
                d: 'Data', g: 'Graphics', m: 'Midi', r: 'Resource', s: 'Scenario', w: 'Wave',
            };
            let basename: string;
            let lines: string[] = [];
            for (let name of files) {
                let type = name.charAt(name.length - 6).toLowerCase();
                let id = name.charAt(name.length - 5);
                basename = name.slice(0, -6);
                lines.push(resourceType[type] + id.toUpperCase() + ' ' + name);
                if (type == 'm')
                    this.hasMidi = true;
            }
            for (let i = 0; i < 26; i++) {
                let id = String.fromCharCode(65 + i);
                lines.push('Save' + id + ' save/' + basename + 's' + id.toLowerCase() + '.asd');
            }
            return lines.join('\n') + '\n';
        }
    }
}
