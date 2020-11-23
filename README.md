[鬼畜王 on Web](https://github.com/kichikuou/web/) のソースコードです。

### 各ディレクトリの説明

#### shell
鬼畜王 on Web のJavaScript部分のソースコードです。

* CDイメージファイルの読み込み
* UI（ツールバー、設定ダイアログなど）　
* ゲームエンジンの下回り（CD音源再生など）

などのコードが含まれています。ビルドにはNode.jsが必要です。以下のコマンドでビルドできます。

    $ npm install
    $ npm run build-shell

#### scss
CSS部分のソースコードです。以下のコマンドでビルドできます。

    $ npm install
    $ npm run build-css

#### fslib
鬼畜王 on Web ではCDイメージのロードが始まってからゲームエンジン (system3 / xsystem35) を初期化するのですが、それ以前にemscriptenのIDBFSファイルシステムにアクセスしたい場合があります。これを実現するためのダミーのEmscriptenプログラムです。

#### docs
https://kichikuou.github.io/web/ で公開されるディレクトリです。HTMLなどの静的ファイルと、ビルド済みのJavaScript/Wasmファイルが入っています。
`system3.*` ファイルは [system3-sdl2](https://github.com/kichikuou/system3-sdl2)、`xsystem35.*` ファイルは [xsystem35-sdl2](https://github.com/kichikuou/xsystem35-sdl2) をビルドしたものです。

### ライセンス
`shell/`, `fslib/` 以下のコードは [MIT ライセンス](shell/LICENSE) です。

`docs/xsystem35.*` ファイルは [xsystem35-sdl2](https://github.com/kichikuou/xsystem35-sdl2) からビルドされたもので、[GPL 2.0](https://github.com/kichikuou/xsystem35-sdl2/blob/emscripten/COPYING) に従います。

`docs/system3.*` ファイルは [system3-sdl2](https://github.com/kichikuou/system3-sdl2) からビルドされたもので、 [GPL 2.0](https://github.com/kichikuou/system3-sdl2/blob/master/COPYING.txt) に従います。

`docs/fonts/MTLc3m.ttf` は Android Open Source Project の "モトヤLシーダ3等幅" フォントであり、[Apache License 2.0](docs/fonts/MTLc3m.ttf.license) に従います。

`docs/fonts/mincho.otf` は [源ノ明朝](https://github.com/adobe-fonts/source-han-serif/) フォントのサブセットです。[SIL Open Font License 1.1](docs/fonts/mincho.otf.license) に従います。サブセット化に使用したスクリプトは [xsystem35-sdl2/fonts](https://github.com/kichikuou/xsystem35-sdl2/blob/emscripten/fonts/CMakeLists.txt) にあります。

また、鬼畜王 on Web では以下のオープンソースソフトウェアを使用しています。
- [Font Awesome](https://fontawesome.com/v4.7.0/) by Dave Gandy ([License](https://fontawesome.com/v4.7.0/license/))
- [JSZip](https://stuk.github.io/jszip/) by Stuart Knightley ([License](https://github.com/Stuk/jszip/blob/v3.1.3/LICENSE.markdown))
- [Spectre.css](https://picturepan2.github.io/spectre/) by Yan Zhu ([License](https://github.com/picturepan2/spectre/blob/v0.5.8/LICENSE))
- [fmgen](http://retropc.net/cisc/m88/download.html) by cisc ([License](https://github.com/kichikuou/fmgen/blob/master/readme.txt))
- [WebAssembly port of libTiMidity](https://github.com/feross/timidity) by Feross Aboukhadijeh ([License](https://github.com/feross/timidity/blob/v1.1.3/LICENSE))
- [LAME MP3 encoder](https://lame.sourceforge.io/) ([License](https://github.com/kichikuou/lame-wasm/blob/master/lame/COPYING))
