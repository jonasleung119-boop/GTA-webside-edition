# Makefile for Taipei GTA Native / Emscripten WASM Build

CXX ?= clang++
CXXFLAGS = -std=c++17 -O3 -Wall -Wextra

# WebAssembly target using Emscripten (emcc/em++)
EMCC = emcc
EMFLAGS = -std=c++17 -O3 \
    -s WASM=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
    -s EXPORTED_FUNCTIONS='["_engine_init","_engine_update","_engine_get_player_x","_engine_get_player_y","_engine_get_player_z","_engine_get_player_heading","_engine_get_player_speed","_engine_get_player_health","_engine_get_player_cash","_engine_get_player_wanted","_engine_get_player_in_vehicle","_engine_get_player_vehicle_id","_engine_get_vehicle_count","_engine_get_vehicle_data","_engine_get_pedestrian_count","_engine_get_pedestrian_data","_engine_add_cash","_engine_add_wanted","_engine_set_player_pos","_engine_toggle_vehicle"]' \
    --no-entry

all: native

native: cpp/engine.o
	@echo "Native C++ build successful"

cpp/engine.o: cpp/engine.cpp cpp/engine.hpp
	$(CXX) $(CXXFLAGS) -c cpp/engine.cpp -o cpp/engine.o

wasm: cpp/engine.cpp cpp/engine.hpp
	$(EMCC) $(EMFLAGS) cpp/engine.cpp -o taipei_engine_emcc.wasm

clean:
	rm -f cpp/*.o
