cmake_minimum_required(VERSION 3.14)
project(InterferometerEngine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/InterferometerEngine.cpp
    src/GaussianBeam.cpp
    src/CoherenceModel.cpp
    src/NoiseGenerator.cpp
)

add_executable(interferometer_engine ${SOURCES})

# Emscripten-specific flags
if(EMSCRIPTEN)
    set_target_properties(interferometer_engine PROPERTIES
        SUFFIX ".js"
    )
    target_link_options(interferometer_engine PRIVATE
        --bind
        -s WASM=1
        -s ALLOW_MEMORY_GROWTH=1
        -s MODULARIZE=1
        -s EXPORT_ES6=1
        -s ENVIRONMENT=web
        -s SINGLE_FILE=0
        -O3
        -msimd128
    )
endif()
