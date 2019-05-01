// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="util.ts" />
/// <reference path="loadersource.ts" />

namespace xsystem35 {
    export class Loader {
        private imageFile: File;
        private metadataFile: File;
        private source: LoaderSource;
        private installing = false;

        constructor(private shell: System35Shell) {
            $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
            document.body.ondragover = this.handleDragOver.bind(this);
            document.body.ondrop = this.handleDrop.bind(this);
        }

        getCDDA(track: number): Promise<Blob> {
            return this.source.getCDDA(track);
        }

        reloadImage(): Promise<any> {
            return this.source.reloadImage();
        }

        private handleFileSelect(evt: Event) {
            let input = <HTMLInputElement>evt.target;
            this.handleFiles(input.files);
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
            this.handleFiles(evt.dataTransfer.files);
        }

        private async handleFiles(files: FileList) {
            if (this.installing)
                return;

            let hasALD = false;
            let recognized = false;
            for (let file of files) {
                if (this.isImageFile(file)) {
                    this.imageFile = file;
                    $('#imgReady').classList.remove('notready');
                    $('#imgReady').textContent = file.name;
                    recognized = true;
                } else if (this.isMetadataFile(file)) {
                    this.metadataFile = file;
                    $('#cueReady').classList.remove('notready');
                    $('#cueReady').textContent = file.name;
                    recognized = true;
                } else if (file.name.toLowerCase().endsWith('.ald')) {
                    hasALD = true;
                } else if (file.name.toLowerCase().endsWith('.rar')) {
                    this.shell.addToast('展開前のrarファイルは読み込めません。', 'warning');
                    recognized = true;
                }
            }

            if (this.imageFile && (this.metadataFile || this.imageFile.name.toLowerCase().endsWith('.iso'))) {
                this.source = new CDImageSource(this.imageFile, this.metadataFile);
            } else if (!this.imageFile && !this.metadataFile) {
                if (files.length == 1 && files[0].name.toLowerCase().endsWith('.zip')) {
                    this.source = new ZipSource(files[0]);
                } else if (hasALD) {
                    this.source = new FileSource(files);
                }
            }

            if (!this.source) {
                if (!recognized)
                    this.shell.addToast(files[0].name + ' は認識できない形式です。', 'warning');
                return;
            }

            this.installing = true;
            try {
                await this.source.startLoad();
                this.shell.loaded(this.source.hasMidi);
            } catch (err) {
                if (err instanceof NoGamedataError) {
                    ga('send', 'event', 'Loader', 'NoGamedata', err.message);
                    this.shell.addToast('インストールできません。' + err.message, 'warning');
                } else {
                    ga('send', 'event', 'Loader', 'LoadFailed', err.message);
                    this.shell.addToast('インストールできません。認識できない形式です。', 'warning');
                }
                this.source = null;
            }
            this.installing = false;
        }

        private isImageFile(file: File): boolean {
            let name = file.name.toLowerCase();
            return name.endsWith('.img') || name.endsWith('.mdf') || name.endsWith('.iso');
        }

        private isMetadataFile(file: File): boolean {
            let name = file.name.toLowerCase();
            return name.endsWith('.cue') || name.endsWith('.ccd') || name.endsWith('.mds');
        }
    }
}
