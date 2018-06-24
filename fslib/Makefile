EMFLAGS := -s MODULARIZE=1 -s EXPORT_NAME="'FSLib'"
EMFLAGS += -s WASM=0 -s ENVIRONMENT=web
EMFLAGS += -s FORCE_FILESYSTEM=1
EMFLAGS += -s 'EXTRA_EXPORTED_RUNTIME_METHODS=["FS"]'
EMFLAGS += --post-js post.js
EMFLAGS += -O2 --memory-init-file 0

../docs/fslib.js: fslib.c post.js Makefile
	emcc $(EMFLAGS) -o $@ $<
