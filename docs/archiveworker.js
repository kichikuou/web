import l from"https://unpkg.com/7z-wasm@1.0.2/7zz.es6.js";onmessage=async c=>{try{let{file:a}=c.data,n=[],e=await l({print:t=>n.push(t)});if(e.FS.mkdir("/archive"),e.FS.mount(e.WORKERFS,{files:[a]},"/archive"),e.callMain(["l","/archive/"+a.name]),!n.some(t=>t.match(/\.(dat|ald)$/i))){postMessage({error:"no game data"});return}n=[],e.FS.mkdir("/out"),e.callMain(["e","-o/out","-aos","-bsp0","/archive/"+a.name]);let s=[],i=[];for(let t of e.FS.readdir("/out")){if(t==="."||t==="..")continue;let o="/out/"+t;if(e.FS.isDir(e.FS.stat(o).mode))continue;let r=e.FS.readFile(o);s.push({name:t,content:r}),i.push(r.buffer)}postMessage({files:s},i)}catch(a){console.warn(a),postMessage({error:"extraction failed"})}close()};
//# sourceMappingURL=archiveworker.js.map
