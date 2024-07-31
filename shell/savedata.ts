// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import type { MainModule as IDBFSModule } from '@irori/idbfs';
import {loadScript, JSZIP_SCRIPT, JSZipOptions} from './util.js';
import {saveDirReady} from './moduleloader.js';
import {addToast, downloadAs} from './widgets.js';
import {message} from './strings.js';

export class SaveDataManager {
    private FSready!: Promise<IDBFSModule['FS']>;

    constructor() {
        if (window['Module'])
            this.FSready = saveDirReady;
        if (!this.FSready) {
            this.FSready = (async () => {
                const idbfsModule = await import('@irori/idbfs');
                const idbfs = await idbfsModule.default();
                idbfs.FS.mkdir('/save', undefined);
                idbfs.FS.mount(idbfs.IDBFS, {}, '/save');
                const err = await new Promise((resolve) => idbfs.FS.syncfs(true, resolve));
                if (err) throw err;
                return idbfs.FS;
            })();
        }
        loadScript(JSZIP_SCRIPT);
    }

    public hasSaveData(): Promise<boolean> {
        function find(fs: IDBFSModule['FS'], dir: string): boolean {
            if (!fs.isDir(fs.stat(dir, undefined).mode))
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
                        fs.mkdirTree('/' + z.name.slice(0, -1), undefined);
                    else
                        addSaveFile(fs, '/' + z.name, await z.async('arraybuffer'));
                }
            }
            await new Promise((resolve, reject) => {
                fs.syncfs(false, (err: any) => {
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
            console.warn(err);
            if (err instanceof Error) {
                gtag('event', 'RestoreFailed', { event_category: 'Savedata', event_label: err.message });
            } else {
                throw err;
            }
        }
    }
}

function storeZip(fs: IDBFSModule['FS'], dir: string, zip: JSZip) {
    for (let name of fs.readdir(dir)) {
        let path = dir + '/' + name;
        if (name[0] === '.') {
            continue;
        } else if (fs.isDir(fs.stat(path, undefined).mode)) {
            storeZip(fs, path, zip.folder(name));
        } else if (!name.toLowerCase().endsWith('.asd.')) {
            let content = fs.readFile(path, { encoding: 'binary' });
            zip.file(name, content);
        }
    }
}

function addSaveFile(fs: IDBFSModule['FS'], path: string, content: ArrayBuffer) {
    fs.writeFile(path, new Uint8Array(content));
}
