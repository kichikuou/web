// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {loadScript, JSZIP_SCRIPT, JSZipOptions, mkdirIfNotExist} from './util.js';
import {saveDirReady} from './moduleloader.js';
import {addToast, downloadAs} from './widgets.js';
import {message} from './strings.js';

declare function FSLib(): {saveDirReady: Promise<typeof FS>};

export class SaveDataManager {
    private FSready!: Promise<typeof FS>;

    constructor() {
        if ((<any>window).FS)
            this.FSready = saveDirReady;
        if (!this.FSready) {
            this.FSready = (async () => {
                await loadScript('fslib.js');
                const fslib = await FSLib();
                return fslib.saveDirReady;
            })();
        }
        loadScript(JSZIP_SCRIPT);
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
        await loadScript(JSZIP_SCRIPT);
        let zip = new JSZip();
        storeZip(await this.FSready, '/save', zip.folder('save'));
        let blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
        downloadAs('savedata.zip', URL.createObjectURL(blob));
        gtag('event', 'Downloaded', { event_category: 'Savedata' });
    }

    public async extract(file: File) {
        try {
            let fs = await this.FSready;
            if (file.name.toLowerCase().endsWith('.asd')) {
                addSaveFile(fs, '/save/' + file.name, await file.arrayBuffer());
            } else {
                await loadScript(JSZIP_SCRIPT);
                let zip = new JSZip();
                await zip.loadAsync(await file.arrayBuffer(), JSZipOptions());
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
                        resolve(undefined);
                });
            });
            addToast(message.restore_success, 'success');
            gtag('event', 'Restored', { event_category: 'Savedata' });
        } catch (err) {
            addToast(message.restore_failure, 'error');
            gtag('event', 'RestoreFailed', { event_category: 'Savedata', event_label: err.message });
            console.warn(err);
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
    fs.writeFile(path, new Uint8Array(content));
}
