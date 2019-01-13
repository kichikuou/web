// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="util.ts" />
/// <reference path="cdimage.ts" />
/// <reference path="datafile.ts" />

namespace xsystem35 {
    export interface Loader {
        getCDDA(track: number): Promise<Blob>;
        reloadImage(): Promise<any>;
    }

    export class ImageLoader implements Loader {
        private imageFile: File;
        private metadataFile: File;
        private imageReader: CDImage.Reader;
        private installing = false;

        constructor(private shell: System35Shell) {
            $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
            document.body.ondragover = this.handleDragOver.bind(this);
            document.body.ondrop = this.handleDrop.bind(this);
        }

        getCDDA(track: number): Promise<Blob> {
            return this.imageReader.extractTrack(track);
        }

        reloadImage(): Promise<any> {
            return openFileInput().then((file) => {
                this.imageReader.resetImage(file);
            });
        }

        private handleFileSelect(evt: Event) {
            let input = <HTMLInputElement>evt.target;
            let files = input.files;
            for (let i = 0; i < files.length; i++)
                this.setFile(files[i]);
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
            let files = evt.dataTransfer.files;
            for (let i = 0; i < files.length; i++)
                this.setFile(files[i]);
        }

        private async setFile(file: File) {
            if (this.installing)
                return;
            let name = file.name.toLowerCase();
            if (name.endsWith('.img') || name.endsWith('.mdf')) {
                this.imageFile = file;
                $('#imgReady').classList.remove('notready');
                $('#imgReady').textContent = file.name;
            } else if (name.endsWith('.cue') || name.endsWith('.ccd') || name.endsWith('.mds')) {
                this.metadataFile = file;
                $('#cueReady').classList.remove('notready');
                $('#cueReady').textContent = file.name;
            } else if (name.endsWith('.rar')) {
                this.shell.addToast('展開前のrarファイルは読み込めません。', 'warning');
            } else {
                this.shell.addToast(name + ' は認識できない形式です。', 'warning');
            }
            if (this.imageFile && this.metadataFile) {
                this.installing = true;
                try {
                    this.imageReader = await CDImage.createReader(this.imageFile, this.metadataFile);
                    await this.startLoad();
                } catch (err) {
                    ga('send', 'event', 'Loader', 'LoadFailed', err.message);
                    this.shell.addToast('インストールできません。認識できない形式です。', 'error');
                }
                this.installing = false;
            }
        }

        private async startLoad() {
            let isofs = await CDImage.ISO9660FileSystem.create(this.imageReader);
            // this.walk(isofs, isofs.rootDir(), '/');
            let gamedata = await this.findGameDir(isofs);
            if (!gamedata) {
                ga('send', 'event', 'Loader', 'NoGamedataDir');
                this.shell.addToast('インストールできません。イメージ内にGAMEDATAフォルダが見つかりません。', 'error');
                return;
            }

            let isSystem3 = !!await isofs.getDirEnt('system3.exe', gamedata);
            $('#loader').classList.add('module-loading');
            await shell.loadModule(isSystem3 ? 'system3' : 'xsystem35');

            let startTime = performance.now();
            let aldFiles = [];
            for (let e of await isofs.readDir(gamedata)) {
                if (!e.name.toLowerCase().endsWith(isSystem3 ? '.dat' : '.ald'))
                    continue;
                let chunks = await isofs.readFile(e);
                registerDataFile(e.name, e.size, chunks);
                aldFiles.push(e.name);
            }
            if (isSystem3) {
                let savedir = await this.saveDir(isofs);
                Module.arguments.push('-savedir', savedir + '/');
                xsystem35.saveDirReady.then(() => { mkdirIfNotExist(savedir); });
            } else {
                FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
                FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
            }
            ga('send', 'timing', 'Image load', this.imageFile.name, Math.round(performance.now() - startTime));

            this.shell.loaded();
        }

        private async findGameDir(isofs: CDImage.ISO9660FileSystem): Promise<CDImage.DirEnt> {
            for (let e of await isofs.readDir(isofs.rootDir())) {
                if (e.isDirectory) {
                    if (e.name.toLowerCase() === 'gamedata' || await isofs.getDirEnt('system3.exe', e))
                        return e;
                }
                if (e.name.toLowerCase() === 'system3.exe')
                    return isofs.rootDir();
            }
            return null;
        }

        private async saveDir(isofs: CDImage.ISO9660FileSystem): Promise<string> {
            let dirname = isofs.volumeLabel();
            if (!dirname) {
                if (await isofs.getDirEnt('prog.bat', isofs.rootDir())) {
                    dirname = 'ProG';
                } else if (await isofs.getDirEnt('dps_all.bat', isofs.rootDir())) {
                    dirname = 'DPS_all';
                } else {
                    dirname = 'untitled';
                    ga('send', 'event', 'Loader', 'NoVolumeLabel');
                }
            }
            return '/save/' + dirname;
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
            }
            for (let i = 0; i < 26; i++) {
                let id = String.fromCharCode(65 + i);
                lines.push('Save' + id + ' save/' + basename + 's' + id.toLowerCase() + '.asd');
            }
            return lines.join('\n') + '\n';
        }

        // For debug
        private async walk(isofs: CDImage.ISO9660FileSystem, dir: CDImage.DirEnt, dirname: string) {
            for (let e of await isofs.readDir(dir)) {
                if (e.name !== '\0' && e.name !== '\x01') {
                    console.log(dirname + e.name);
                    if (e.isDirectory)
                        this.walk(isofs, e, dirname + e.name + '/');
                }
            }
        }
    }
}
