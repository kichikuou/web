// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

declare function FSLib(): {saveDirReady: Promise<typeof FS>};

namespace xsystem35 {
    let FSLibLoaded: Promise<any>;
    let JSZipLoaded: Promise<any>;

    export class SaveDataManager {
        private FSready: Promise<typeof FS>;

        constructor() {
            if ((<any>window).FS)
                this.FSready = xsystem35.saveDirReady;
            if (!this.FSready) {
                if (!FSLibLoaded)
                    FSLibLoaded = loadScript('fslib.js');
                this.FSready = FSLibLoaded.then(() => FSLib().saveDirReady);
            }
            if (!JSZipLoaded)
                JSZipLoaded = loadScript('lib/jszip.3.1.3.min.js');
        }

        public hasSaveData(): Promise<boolean> {
            function find(fs: typeof FS, dir: string): boolean {
                if (!fs.isDir(fs.stat(dir).mode))
                    return false;
                for (let name of fs.readdir(dir) as string[]) {
                    if (name[0] === '.')
                        continue;
                    if (name.toLowerCase().endsWith('.asd') || name.toLowerCase().endsWith('.dat'))
                        return true;
                    if (find(fs, dir + '/' + name))
                        return true;
                }
                return false;
            }
            return this.FSready.then((fs) => find(fs, '/save'));
        }

        public async download() {
            await JSZipLoaded;
            let zip = new JSZip();
            storeZip(await this.FSready, '/save', zip.folder('save'));
            let blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
            if (navigator.msSaveBlob) {  // Edge
                navigator.msSaveBlob(blob, 'savedata.zip');
            } else {
                let elem = document.createElement('a');
                elem.setAttribute('download', 'savedata.zip');
                elem.setAttribute('href', URL.createObjectURL(blob));
                document.body.appendChild(elem);
                elem.click();
                setTimeout(() => { document.body.removeChild(elem); }, 5000);
            }
            ga('send', 'event', 'Savedata', 'Downloaded');
        }

        public async extract(file: File) {
            try {
                let fs = await this.FSready;
                if (file.name.toLowerCase().endsWith('.asd')) {
                    addSaveFile(fs, '/save/' + file.name, await readFileAsArrayBuffer(file));
                } else {
                    await JSZipLoaded;
                    let zip = new JSZip();
                    let opts: JSZipLoadOptions = {};
                    if (typeof TextDecoder !== 'undefined')
                        opts = {decodeFileName} as JSZipLoadOptions;
                    await zip.loadAsync(await readFileAsArrayBuffer(file), opts);
                    let entries: JSZipObject[] = [];
                    zip.folder('save').forEach((path, z) => { entries.push(z); });
                    for (let z of entries) {
                        if (z.dir)
                            mkdirIfNotExist('/' + z.name.slice(0, -1), fs);
                        else
                            addSaveFile(fs, '/' + z.name, await z.async('arraybuffer'));
                    }
                }
                await new Promise((resolve, reject) => {
                    fs.syncfs(false, (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
                xsystem35.shell.addToast('セーブデータの復元に成功しました。', 'success');
                ga('send', 'event', 'Savedata', 'Restored');
            } catch (err) {
                xsystem35.shell.addToast('セーブデータを復元できませんでした。', 'error');
                ga('send', 'event', 'Savedata', 'RestoreFailed', err.message);
                console.warn(err);
                ga('send', 'exception', {exDescription: err.stack, exFatal: false});
            }
        }
    }

    function storeZip(fs: typeof FS, dir: string, zip: JSZip) {
        for (let name of fs.readdir(dir)) {
            let path = dir + '/' + name;
            if (name[0] === '.') {
                continue;
            } else if (fs.isDir(fs.stat(path).mode)) {
                storeZip(fs, path, zip.folder(name));
            } else if (!name.toLowerCase().endsWith('.asd.')) {
                let content = fs.readFile(path, { encoding: 'binary' });
                zip.file(name, content);
            }
        }
    }

    function addSaveFile(fs: typeof FS, path: string, content: ArrayBuffer) {
        fs.writeFile(path, new Uint8Array(content), { encoding: 'binary' });
    }

    function decodeFileName(bytes: Uint8Array): string {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (err) {
            return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
        }
    }
}
