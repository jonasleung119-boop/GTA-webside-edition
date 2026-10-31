cmake_minimum_required(VERSION 3.15)
project(TaipeiGTA_Engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(taipei_engine STATIC
    engine.cpp
    engine.hpp
)

target_include_directories(taipei_engine PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

if(EMSCRIPTEN)
    set_target_properties(taipei_engine PROPERTIES
        OUTPUT_NAME "taipei_engine"
        SUFFIX ".wasm"
    )
    set_target_properties(taipei_engine PROPERTIES LINK_FLAGS "-s WASM=1 --no-entry")
endif()
