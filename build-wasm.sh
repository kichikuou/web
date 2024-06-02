#!/bin/sh
set -e

if [ ! -f "xsystem35-sdl2/CMakeLists.txt" ] || [ ! -f "system3-sdl2/CMakeLists.txt" ]; then
    git submodule update --init --recursive
fi

if [ ! -d "xsystem35-sdl2/out" ]; then
    emcmake cmake -DCMAKE_BUILD_TYPE=MinSizeRel -DCMAKE_COMPILE_WARNING_AS_ERROR=YES -S xsystem35-sdl2 -B xsystem35-sdl2/out
fi
cmake --build xsystem35-sdl2/out && cp xsystem35-sdl2/out/src/xsystem35.* dist/

if [ ! -d "system3-sdl2/out" ]; then
    emcmake cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_COMPILE_WARNING_AS_ERROR=YES -S system3-sdl2 -B system3-sdl2/out
fi
cmake --build system3-sdl2/out && cp system3-sdl2/out/system3.* dist/
