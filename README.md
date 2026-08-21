This is the source code for the
[Kichikuou on Web](https://kichikuou.github.io/web/) website.

## Building the site

To build the site, you will need to have the following software installed:

- [Node.js](https://nodejs.org)
- [Emscripten](https://emscripten.org/)
- [CMake](https://cmake.org/)

First, clone the repository and install the dependencies:

```sh
git clone --recurse-submodules https://github.com/kichikuou/web.git
cd web
npm install
```

Then, build the WebAssembly modules:

```sh
./build-wasm.sh
```

Finally, build the site:

```sh
npm run build
```

The built site will be in the `dist` directory. You can serve the site locally
using the `serve` command:

```sh
npm run serve
```

## Licenses
Code in the `shell/` and `fslib/` directories is licensed under the
[MIT License](shell/LICENSE).

The [xsystem35-sdl2] submodule is licensed under
[GPL 2.0](https://github.com/kichikuou/xsystem35-sdl2/blob/master/COPYING).

The [system3-sdl2] submodule is licensed under
[GPL 2.0](https://github.com/kichikuou/system3-sdl2/blob/master/COPYING).

The fonts in `dist/fonts/` are copied from the [xsystem35-sdl2] submodule at
build time.

`MTLc3m.ttf` is the "モトヤLシーダ3等幅" font from the Android Open Source
Project and is licensed under the
[Apache License 2.0](https://github.com/kichikuou/xsystem35-sdl2/blob/master/licenses/MTLc3m.txt).

`mincho.ttf` is a subset of the [IPA Mincho](https://moji.or.jp/ipafont/) font and is licensed under the
[IPA Font License v1.0](https://github.com/kichikuou/xsystem35-sdl2/blob/master/licenses/mincho.txt).
The script used for subsetting can be found in
[xsystem35-sdl2/fonts](https://github.com/kichikuou/xsystem35-sdl2/blob/master/fonts/CMakeLists.txt).

This site also uses the following open-source software:

- [Font Awesome](https://fontawesome.com/v4.7.0/) by Dave Gandy ([License](https://fontawesome.com/v4.7.0/license/))
- [Spectre.css](https://picturepan2.github.io/spectre/) by Yan Zhu ([License](https://github.com/picturepan2/spectre/blob/v0.5.8/LICENSE))
- [spessasynth_lib](https://github.com/spessasus/spessasynth_lib) by Spessasus ([License](https://github.com/spessasus/spessasynth_lib/blob/v4.0.0/LICENSE))
- [GeneralUser GS](https://www.schristiancollins.com/generaluser) by S. Christian Collins ([License](https://github.com/mrbumpy409/GeneralUser-GS/blob/d0fc360abafa736f11a1fa18c721f65bfc3a6991/documentation/LICENSE.txt))
- [stbvorbis.js](https://github.com/hajimehoshi/stbvorbis.js) ([License](https://github.com/hajimehoshi/stbvorbis.js/blob/v0.2.2/LICENSE))

[system3-sdl2]: https://github.com/kichikuou/system3-sdl2
[xsystem35-sdl2]: https://github.com/kichikuou/xsystem35-sdl2