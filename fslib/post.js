// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

FS.mkdir('/save');
FS.mount(IDBFS, {}, '/save');
FSLib.saveDirReady = new Promise(function(resolve, reject) {
    FS.syncfs(true, function(err) {
	if (err)
	    reject(err);
	else
	    resolve(FS);
    });
});
