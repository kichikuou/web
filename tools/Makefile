../docs/fonts/mincho.otf: SourceHanSerifJP-Regular.otf uchars.txt
	pyftsubset SourceHanSerifJP-Regular.otf --text-file=uchars.txt --output-file=$@

SourceHanSerifJP-Regular.otf:
	wget -O $@ 'https://github.com/adobe-fonts/source-han-serif/blob/release/SubsetOTF/JP/SourceHanSerifJP-Regular.otf?raw=true'

uchars.txt:
	wget https://github.com/kichikuou/xsystem35-sdl2/raw/emscripten/tools/uchars.txt
