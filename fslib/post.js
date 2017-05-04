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
