#!/bin/sh
set -e

if [ ! -f "xsystem35-sdl2/CMakeLists.txt" ] || [ ! -f "system3-sdl2/CMakeLists.txt" ]; then
    git submodule update --init --recursive
fi

mkdir -p dist/jspi shell/jspi

if [ ! -d "xsystem35-sdl2/out/asyncify" ]; then
    emcmake cmake -DCMAKE_BUILD_TYPE=MinSizeRel -DCMAKE_COMPILE_WARNING_AS_ERROR=YES -S xsystem35-sdl2 -B xsystem35-sdl2/out/asyncify
fi
cmake --build xsystem35-sdl2/out/asyncify
cp xsystem35-sdl2/out/asyncify/src/xsystem35.js dist/
cp xsystem35-sdl2/out/asyncify/src/xsystem35.wasm dist/
cp xsystem35-sdl2/out/asyncify/src/xsystem35.d.ts shell/

if [ ! -d "xsystem35-sdl2/out/jspi" ]; then
    emcmake cmake -DCMAKE_BUILD_TYPE=MinSizeRel -DCMAKE_COMPILE_WARNING_AS_ERROR=YES -DJSPI=ON -S xsystem35-sdl2 -B xsystem35-sdl2/out/jspi
fi
cmake --build xsystem35-sdl2/out/jspi
cp xsystem35-sdl2/out/jspi/src/xsystem35.js dist/jspi/
cp xsystem35-sdl2/out/jspi/src/xsystem35.wasm dist/jspi/
cp xsystem35-sdl2/out/jspi/src/xsystem35.d.ts shell/jspi/

if [ ! -d "system3-sdl2/out/asyncify" ]; then
    emcmake cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_COMPILE_WARNING_AS_ERROR=YES -S system3-sdl2 -B system3-sdl2/out/asyncify
fi
cmake --build system3-sdl2/out/asyncify
cp system3-sdl2/out/asyncify/system3.js dist/
cp system3-sdl2/out/asyncify/system3.wasm dist/
cp system3-sdl2/out/asyncify/system3.d.ts shell/

if [ ! -d "system3-sdl2/out/jspi" ]; then
    emcmake cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_COMPILE_WARNING_AS_ERROR=YES -DJSPI=ON -S system3-sdl2 -B system3-sdl2/out/jspi
fi
cmake --build system3-sdl2/out/jspi
cp system3-sdl2/out/jspi/system3.js dist/jspi/
cp system3-sdl2/out/jspi/system3.wasm dist/jspi/
cp system3-sdl2/out/jspi/system3.d.ts shell/jspi/
