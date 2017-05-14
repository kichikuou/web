/// <reference path="util.ts" />
/// <reference path="cdimage.ts" />

namespace xsystem35 {
    export class ImageLoader {
        private imgFile: File;
        private cueFile: File;
        private imageReader: CDImage.Reader;

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
            let name = file.name.toLowerCase();
            if (name.endsWith('.img') || name.endsWith('.mdf')) {
                this.imgFile = file;
                $('#imgReady').classList.remove('notready');
                $('#imgReady').textContent = file.name;
            } else if (name.endsWith('.cue') || name.endsWith('.mds')) {
                this.cueFile = file;
                $('#cueReady').classList.remove('notready');
                $('#cueReady').textContent = file.name;
            }
            if (this.imgFile && this.cueFile) {
                try {
                    this.imageReader = await CDImage.createReader(this.imgFile, this.cueFile);
                    this.startLoad();
                } catch (err) {
                    ga('send', 'event', 'Loader', 'LoadFailed', err.message);
                    this.shell.addToast('インストールできません。認識できない形式です。', 'danger');
                }
            }
        }

        private async extractFile(isofs: CDImage.ISO9660FileSystem, entry: CDImage.DirEnt,
                                  buf: Uint8Array, offset: number) {
            let ptr = 0;
            for (let chunk of await isofs.readFile(entry)) {
                buf.set(chunk, ptr + offset);
                ptr += chunk.byteLength;
            }
            if (ptr !== entry.size)
                throw new Error('expected ' + entry.size + ' bytes, but read ' + ptr + 'bytes');
        }

        private async startLoad() {
            let isofs = await CDImage.ISO9660FileSystem.create(this.imageReader);
            // this.walk(isofs, isofs.rootDir(), '/');
            let gamedata = await isofs.getDirEnt('gamedata', isofs.rootDir()) ||
                           await isofs.getDirEnt('mugen', isofs.rootDir());
            if (!gamedata) {
                ga('send', 'event', 'Loader', 'NoGamedataDir');
                this.shell.addToast('インストールできません。イメージ内にGAMEDATAフォルダが見つかりません。', 'danger');
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
                // Store contents in the emscripten heap, so that it can be mmap-ed without copying
                let ptr = Module.getMemory(e.size);
                await this.extractFile(isofs, e, Module.HEAPU8, ptr);
                FS.writeFile(e.name, Module.HEAPU8.subarray(ptr, ptr + e.size), { encoding: 'binary', canOwn: true });
                aldFiles.push(e.name);
            }
            if (isSystem3) {
                let savedir = '/save/' + isofs.volumeLabel();
                Module.arguments.push('-savedir', savedir + '/');
                xsystem35.saveDirReady.then(() => { mkdirIfNotExist(savedir); });
            } else {
                FS.writeFile('xsystem35.gr', this.createGr(aldFiles));
                FS.writeFile('.xsys35rc', xsystem35.xsys35rc);
            }
            ga('send', 'timing', 'Image load', this.imgFile.name, Math.round(performance.now() - startTime));

            this.shell.loaded();
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
