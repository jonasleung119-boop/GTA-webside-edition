// engine.hpp - Taipei GTA High-Performance Native Simulation Engine (C++)
// Exposes complete vehicle physics, traffic AI, player mechanics, and collision systems
// Designed for both native builds and WebAssembly (WASM) via Emscripten / Clang.

#ifndef TAIPEI_ENGINE_HPP
#define TAIPEI_ENGINE_HPP

#include <cstdint>
#include <cmath>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

namespace TaipeiGTA {

enum VehicleType : int32_t {
    VEHICLE_SCOOTER = 0,
    VEHICLE_TAXI    = 1,
    VEHICLE_TRUCK   = 2,
    VEHICLE_POLICE  = 3,
    VEHICLE_SPORTS  = 4
};

struct VehicleSpecs {
    float maxSpeed;
    float accel;
    float brake;
    float steerSpeed;
    float maxSteer;
    float drag;
    float mass;
    float radius;
    float length;
    float width;
};

struct VehicleState {
    int32_t id;
    int32_t active;
    int32_t type;
    int32_t isPlayer;
    int32_t isDrifting;
    float x;
    float y;
    float z;
    float heading;
    float speed;
    float steerAngle;
    float leanAngle;
    float health;
};

struct PedestrianState {
    int32_t id;
    int32_t active;
    float x;
    float z;
    float heading;
    float speed;
    float animTime;
    int32_t health;
};

struct PlayerState {
    float x;
    float y;
    float z;
    float heading;
    float speed;
    int32_t health;
    int32_t cash;
    int32_t wantedLevel;
    int32_t inVehicle;
    int32_t vehicleId;
    float sprintMultiplier;
};

struct InputFlags {
    bool forward;
    bool backward;
    bool left;
    bool right;
    bool sprint;
    bool handbrake;
    bool action;
};

constexpr int MAX_VEHICLES = 32;
constexpr int MAX_PEDESTRIANS = 48;
constexpr float WORLD_HALF_SIZE = 600.0f;
constexpr float ROAD_WIDTH = 24.0f;
constexpr float BLOCK_SIZE = 120.0f;

class Engine {
public:
    Engine();
    void init(uint32_t seed);
    void update(float dt, uint32_t inputMask, int32_t playerInVehicleReq);

    // Player getters
    float getPlayerX() const { return player.x; }
    float getPlayerY() const { return player.y; }
    float getPlayerZ() const { return player.z; }
    float getPlayerHeading() const { return player.heading; }
    float getPlayerSpeed() const { return player.speed; }
    int32_t getPlayerHealth() const { return player.health; }
    int32_t getPlayerCash() const { return player.cash; }
    int32_t getPlayerWanted() const { return player.wantedLevel; }
    int32_t getPlayerInVehicle() const { return player.inVehicle; }
    int32_t getPlayerVehicleId() const { return player.vehicleId; }

    // Vehicle getters
    int32_t getVehicleCount() const { return MAX_VEHICLES; }
    const VehicleState& getVehicle(int32_t index) const;
    VehicleState* getVehiclePtr(int32_t index);

    // Pedestrian getters
    int32_t getPedestrianCount() const { return MAX_PEDESTRIANS; }
    const PedestrianState& getPedestrian(int32_t index) const;

    // Actions & Events
    void addCash(int32_t amount) { player.cash += amount; }
    void addWanted(int32_t stars);
    void setPlayerPos(float x, float z);
    void triggerHorn();
    void triggerMountDismount();

    // Memory buffer export for zero-copy WASM interface
    const void* getStateBuffer() const { return &player; }
    uint32_t getStateBufferSize() const { return sizeof(player) + sizeof(vehicles) + sizeof(pedestrians); }

private:
    PlayerState player;
    VehicleState vehicles[MAX_VEHICLES];
    PedestrianState pedestrians[MAX_PEDESTRIANS];
    uint32_t rngSeed;

    float randomFloat(float min, float max);
    VehicleSpecs getSpecs(int32_t type) const;
    void updatePlayer(float dt, const InputFlags& input);
    void updateVehicles(float dt, const InputFlags& input);
    void updatePedestrians(float dt);
    void updatePoliceAI(float dt);
    void handleCollisions();
    bool checkBuildingCollision(float x, float z, float radius) const;
};

} // namespace TaipeiGTA

// C-linkage exports for WebAssembly binary interface
extern "C" {
    WASM_EXPORT void engine_init(uint32_t seed);
    WASM_EXPORT void engine_update(float dt, uint32_t inputMask, int32_t playerInVehicleReq);
    WASM_EXPORT float engine_get_player_x();
    WASM_EXPORT float engine_get_player_y();
    WASM_EXPORT float engine_get_player_z();
    WASM_EXPORT float engine_get_player_heading();
    WASM_EXPORT float engine_get_player_speed();
    WASM_EXPORT int32_t engine_get_player_health();
    WASM_EXPORT int32_t engine_get_player_cash();
    WASM_EXPORT int32_t engine_get_player_wanted();
    WASM_EXPORT int32_t engine_get_player_in_vehicle();
    WASM_EXPORT int32_t engine_get_player_vehicle_id();

    WASM_EXPORT int32_t engine_get_vehicle_count();
    WASM_EXPORT float engine_get_vehicle_data(int32_t index, int32_t field);
    WASM_EXPORT int32_t engine_get_pedestrian_count();
    WASM_EXPORT float engine_get_pedestrian_data(int32_t index, int32_t field);

    WASM_EXPORT void engine_add_cash(int32_t amount);
    WASM_EXPORT void engine_add_wanted(int32_t stars);
    WASM_EXPORT void engine_set_player_pos(float x, float z);
    WASM_EXPORT void engine_toggle_vehicle();
}

#endif // TAIPEI_ENGINE_HPP
