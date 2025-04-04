// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import type { MainModule as IDBFSModule } from '@irori/idbfs';
import {saveDirReady} from './moduleloader.js';
import {addToast, downloadAs} from './widgets.js';
import {message} from './strings.js';
import * as zip from './zip.js';

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
                idbfs.FS.mkdir('/patton', undefined);
                idbfs.FS.mount(idbfs.IDBFS, {}, '/patton');
                const err = await new Promise((resolve) => idbfs.FS.syncfs(true, resolve));
                if (err) throw err;
                return idbfs.FS;
            })();
        }
    }

    public async hasSaveData(): Promise<boolean> {
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
        const fs = await this.FSready;
        return find(fs, '/save') || hasPattonSave(fs);
    }

    public async download() {
        const builder = new zip.ZipBuilder();
        const fs = await this.FSready;
        await addToZip(fs, '/save', builder);
        if (hasPattonSave(fs)) {
            await addToZip(fs, '/patton', builder);
        }
        const blob = await builder.build();
        downloadAs('savedata.zip', URL.createObjectURL(blob));
        gtag('event', 'Downloaded', { event_category: 'Savedata' });
    }

    public async extract(file: File) {
        try {
            let fs = await this.FSready;
            if (file.name.toLowerCase().endsWith('.asd')) {
                fs.writeFile('/save/' + file.name, new Uint8Array(await file.arrayBuffer()));
            } else {
                const files = await zip.load(file);
                for (const file of files) {
                    if (!file.name.startsWith('save/') && !file.name.startsWith('patton/'))
                        continue;
                    if (file.name.endsWith('/')) {
                        fs.mkdirTree('/' + file.name, undefined);
                    } else {
                        fs.writeFile('/' + file.name, await file.extract());
                    }
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

async function addToZip(fs: IDBFSModule['FS'], path: string, builder: zip.ZipBuilder) {
    if (path[0] !== '/') {
        throw new Error('addToZip: path must start with /');
    }
    const pathInZip = path.slice(1);
    const stat = fs.stat(path, undefined);
    if (fs.isDir(stat.mode)) {
        await builder.addDir(pathInZip, new Date(stat.mtime));
        for (const name of fs.readdir(path)) {
            if (name[0] === '.') continue;
            await addToZip(fs, path + '/' + name, builder);
        }
    } else {
        const content = fs.readFile(path, { encoding: 'binary' });
        await builder.addFile(pathInZip, content, new Date(stat.mtime));
    }
}

export function hasPattonSave(fs: IDBFSModule['FS']): boolean {
    try {
        fs.stat('/patton/patton.nhd', undefined);
        return true;
    } catch (e) {
        return false;
    }
}
