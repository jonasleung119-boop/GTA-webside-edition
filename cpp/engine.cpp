// engine.cpp - Taipei GTA High-Performance Native Simulation Engine Implementation (C++)
#include "engine.hpp"

namespace TaipeiGTA {

static Engine g_engine;

Engine::Engine() : rngSeed(1337) {}

float Engine::randomFloat(float min, float max) {
    // Fast LCG pseudorandom number generator for deterministic WASM execution
    rngSeed = rngSeed * 1664525u + 1013904223u;
    float norm = static_cast<float>(rngSeed & 0x00FFFFFF) / static_cast<float>(0x00FFFFFF);
    return min + norm * (max - min);
}

VehicleSpecs Engine::getSpecs(int32_t type) const {
    switch (type) {
        case VEHICLE_SCOOTER:
            return { 75.0f, 28.0f, 45.0f, 3.2f, 0.65f, 0.985f, 120.0f, 1.4f, 2.2f, 0.8f };
        case VEHICLE_TAXI:
            return { 105.0f, 30.0f, 50.0f, 2.6f, 0.52f, 0.988f, 1400.0f, 2.4f, 4.6f, 1.9f };
        case VEHICLE_TRUCK:
            return { 85.0f, 20.0f, 40.0f, 2.0f, 0.44f, 0.982f, 2200.0f, 2.8f, 5.2f, 2.1f };
        case VEHICLE_POLICE:
            return { 120.0f, 38.0f, 58.0f, 2.9f, 0.55f, 0.990f, 1600.0f, 2.4f, 4.8f, 1.9f };
        case VEHICLE_SPORTS:
        default:
            return { 145.0f, 48.0f, 65.0f, 3.2f, 0.58f, 0.992f, 1300.0f, 2.3f, 4.5f, 2.0f };
    }
}

void Engine::init(uint32_t seed) {
    rngSeed = seed == 0 ? 123456789 : seed;

    // Initialize player state
    player.x = 0.0f;
    player.y = 0.0f;
    player.z = 50.0f;
    player.heading = 0.0f;
    player.speed = 0.0f;
    player.health = 100;
    player.cash = 25800;
    player.wantedLevel = 0;
    player.inVehicle = 0;
    player.vehicleId = -1;
    player.sprintMultiplier = 1.0f;

    // Spawn starter vehicles
    // 0: Player scooter
    vehicles[0] = { 0, 1, VEHICLE_SCOOTER, 0, 0, 3.0f, 0.0f, 50.0f, 1.57079f, 0.0f, 0.0f, 0.0f, 100.0f };
    // 1: Yellow taxi nearby
    vehicles[1] = { 1, 1, VEHICLE_TAXI, 0, 0, -8.0f, 0.0f, 48.0f, 0.0f, 0.0f, 0.0f, 0.0f, 100.0f };
    // 2: Sports car nearby
    vehicles[2] = { 2, 1, VEHICLE_SPORTS, 0, 0, 8.0f, 0.0f, 48.0f, 0.0f, 0.0f, 0.0f, 0.0f, 100.0f };
    // 3: Blue truck nearby
    vehicles[3] = { 3, 1, VEHICLE_TRUCK, 0, 0, -18.0f, 0.0f, 120.0f, 1.57079f, 0.0f, 0.0f, 0.0f, 100.0f };

    // Ambient traffic vehicles
    for (int i = 4; i < MAX_VEHICLES; ++i) {
        int32_t vType = (i % 5 == 0) ? VEHICLE_SCOOTER :
                        (i % 5 == 1) ? VEHICLE_TAXI :
                        (i % 5 == 2) ? VEHICLE_TRUCK :
                        (i % 5 == 3) ? VEHICLE_SPORTS : VEHICLE_POLICE;

        // Spread along avenues
        float rx = ((i * 37) % 500) - 250.0f;
        float rz = ((i * 73) % 500) - 250.0f;
        float heading = (i % 2 == 0) ? 0.0f : 1.57079f;

        vehicles[i] = {
            i, 1, vType, 0, 0,
            rx, 0.0f, rz,
            heading,
            randomFloat(15.0f, 35.0f),
            0.0f, 0.0f, 100.0f
        };
    }

    // Pedestrians
    for (int i = 0; i < MAX_PEDESTRIANS; ++i) {
        float px = randomFloat(-350.0f, 350.0f);
        float pz = randomFloat(-350.0f, 350.0f);
        pedestrians[i] = {
            i, 1, px, pz,
            randomFloat(0.0f, 6.28318f),
            randomFloat(1.5f, 3.5f),
            randomFloat(0.0f, 10.0f),
            100
        };
    }
}

void Engine::update(float dt, uint32_t inputMask, int32_t playerInVehicleReq) {
    (void)playerInVehicleReq;
    if (dt <= 0.0f || dt > 0.1f) dt = 0.01666f;

    InputFlags input;
    input.forward   = (inputMask & (1 << 0)) != 0;
    input.backward  = (inputMask & (1 << 1)) != 0;
    input.left      = (inputMask & (1 << 2)) != 0;
    input.right     = (inputMask & (1 << 3)) != 0;
    input.sprint    = (inputMask & (1 << 4)) != 0;
    input.handbrake = (inputMask & (1 << 5)) != 0;
    input.action    = (inputMask & (1 << 6)) != 0;

    if (input.action) {
        triggerMountDismount();
    }

    updatePlayer(dt, input);
    updateVehicles(dt, input);
    updatePedestrians(dt);
    if (player.wantedLevel > 0) {
        updatePoliceAI(dt);
    }
    handleCollisions();
}

void Engine::triggerMountDismount() {
    if (player.inVehicle) {
        // Dismount
        int vid = player.vehicleId;
        if (vid >= 0 && vid < MAX_VEHICLES) {
            vehicles[vid].isPlayer = 0;
            player.x = vehicles[vid].x + std::cos(vehicles[vid].heading + 1.57f) * 2.5f;
            player.z = vehicles[vid].z + std::sin(vehicles[vid].heading + 1.57f) * 2.5f;
        }
        player.inVehicle = 0;
        player.vehicleId = -1;
        player.speed = 0.0f;
    } else {
        // Find nearest vehicle within 4.5m
        float bestDist = 4.5f;
        int bestIdx = -1;
        for (int i = 0; i < MAX_VEHICLES; ++i) {
            if (!vehicles[i].active) continue;
            float dx = vehicles[i].x - player.x;
            float dz = vehicles[i].z - player.z;
            float dist = std::sqrt(dx * dx + dz * dz);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }

        if (bestIdx >= 0) {
            player.inVehicle = 1;
            player.vehicleId = bestIdx;
            vehicles[bestIdx].isPlayer = 1;
        }
    }
}

void Engine::updatePlayer(float dt, const InputFlags& input) {
    if (player.inVehicle) {
        int vid = player.vehicleId;
        if (vid >= 0 && vid < MAX_VEHICLES) {
            player.x = vehicles[vid].x;
            player.y = vehicles[vid].y;
            player.z = vehicles[vid].z;
            player.heading = vehicles[vid].heading;
            player.speed = vehicles[vid].speed;
        }
        return;
    }

    float moveSpeed = input.sprint ? 12.0f : 6.0f;
    float targetSpeed = 0.0f;
    float steer = 0.0f;

    if (input.forward) targetSpeed += moveSpeed;
    if (input.backward) targetSpeed -= moveSpeed * 0.6f;
    if (input.left) steer -= 3.5f * dt;
    if (input.right) steer += 3.5f * dt;

    player.heading += steer;
    player.speed += (targetSpeed - player.speed) * 8.0f * dt;

    float nx = player.x + std::sin(player.heading) * player.speed * dt;
    float nz = player.z + std::cos(player.heading) * player.speed * dt;

    if (!checkBuildingCollision(nx, nz, 0.5f)) {
        player.x = nx;
        player.z = nz;
    } else {
        player.speed = 0.0f;
    }
}

void Engine::updateVehicles(float dt, const InputFlags& input) {
    for (int i = 0; i < MAX_VEHICLES; ++i) {
        if (!vehicles[i].active) continue;
        VehicleSpecs spec = getSpecs(vehicles[i].type);

        if (vehicles[i].isPlayer) {
            // Player controlled vehicle
            float accelTarget = 0.0f;
            if (input.forward) accelTarget += spec.accel;
            if (input.backward) accelTarget -= spec.brake;

            if (input.left) {
                vehicles[i].steerAngle += spec.steerSpeed * dt;
                if (vehicles[i].steerAngle > spec.maxSteer) vehicles[i].steerAngle = spec.maxSteer;
            } else if (input.right) {
                vehicles[i].steerAngle -= spec.steerSpeed * dt;
                if (vehicles[i].steerAngle < -spec.maxSteer) vehicles[i].steerAngle = -spec.maxSteer;
            } else {
                vehicles[i].steerAngle *= 0.85f;
            }

            vehicles[i].isDrifting = input.handbrake ? 1 : 0;
            float dragFactor = vehicles[i].isDrifting ? 0.96f : spec.drag;

            vehicles[i].speed += accelTarget * dt;
            vehicles[i].speed *= dragFactor;

            if (vehicles[i].speed > spec.maxSpeed) vehicles[i].speed = spec.maxSpeed;
            if (vehicles[i].speed < -spec.maxSpeed * 0.35f) vehicles[i].speed = -spec.maxSpeed * 0.35f;

            float turnRate = vehicles[i].steerAngle * (vehicles[i].speed / spec.maxSpeed);
            if (vehicles[i].isDrifting) turnRate *= 1.8f;
            vehicles[i].heading += turnRate * 2.2f * dt;

            // Scooter banking lean angle
            if (vehicles[i].type == VEHICLE_SCOOTER) {
                float targetLean = -vehicles[i].steerAngle * (std::abs(vehicles[i].speed) / 40.0f) * 0.5f;
                vehicles[i].leanAngle += (targetLean - vehicles[i].leanAngle) * 8.0f * dt;
            }

            float nx = vehicles[i].x + std::sin(vehicles[i].heading) * (vehicles[i].speed * 0.277f) * dt;
            float nz = vehicles[i].z + std::cos(vehicles[i].heading) * (vehicles[i].speed * 0.277f) * dt;

            if (!checkBuildingCollision(nx, nz, spec.radius)) {
                vehicles[i].x = nx;
                vehicles[i].z = nz;
            } else {
                vehicles[i].speed = -vehicles[i].speed * 0.4f;
                vehicles[i].health -= 8.0f;
            }
        } else {
            // Ambient traffic driving AI
            float speedKmh = vehicles[i].speed;
            float nx = vehicles[i].x + std::sin(vehicles[i].heading) * (speedKmh * 0.277f) * dt;
            float nz = vehicles[i].z + std::cos(vehicles[i].heading) * (speedKmh * 0.277f) * dt;

            // Simple loop bound check
            if (std::abs(nx) > WORLD_HALF_SIZE - 20.0f || std::abs(nz) > WORLD_HALF_SIZE - 20.0f) {
                vehicles[i].heading += 3.14159f;
            } else {
                vehicles[i].x = nx;
                vehicles[i].z = nz;
            }
        }
    }
}

void Engine::updatePedestrians(float dt) {
    for (int i = 0; i < MAX_PEDESTRIANS; ++i) {
        if (!pedestrians[i].active) continue;
        pedestrians[i].animTime += dt * 6.0f;
        pedestrians[i].x += std::sin(pedestrians[i].heading) * pedestrians[i].speed * dt;
        pedestrians[i].z += std::cos(pedestrians[i].heading) * pedestrians[i].speed * dt;

        if (std::abs(pedestrians[i].x) > WORLD_HALF_SIZE - 30.0f || std::abs(pedestrians[i].z) > WORLD_HALF_SIZE - 30.0f) {
            pedestrians[i].heading += 3.14159f;
        }
    }
}

void Engine::updatePoliceAI(float dt) {
    // Direct police vehicles to chase player position
    for (int i = 0; i < MAX_VEHICLES; ++i) {
        if (!vehicles[i].active || vehicles[i].type != VEHICLE_POLICE || vehicles[i].isPlayer) continue;

        float dx = player.x - vehicles[i].x;
        float dz = player.z - vehicles[i].z;
        float dist = std::sqrt(dx * dx + dz * dz);
        if (dist > 5.0f) {
            float targetHeading = std::atan2(dx, dz);
            float diff = targetHeading - vehicles[i].heading;
            while (diff > 3.14159f) diff -= 6.28318f;
            while (diff < -3.14159f) diff += 6.28318f;

            vehicles[i].heading += diff * 2.5f * dt;
            vehicles[i].speed += (95.0f - vehicles[i].speed) * 3.0f * dt;
        }
    }
}

void Engine::setPlayerPos(float x, float z) {
    player.x = x;
    player.z = z;
}

void Engine::triggerHorn() {
    // Honking near pedestrians makes them panic, honking near police adds suspicion
    for (int i = 0; i < MAX_PEDESTRIANS; ++i) {
        float dx = pedestrians[i].x - player.x;
        float dz = pedestrians[i].z - player.z;
        if (dx * dx + dz * dz < 100.0f) {
            pedestrians[i].speed *= 1.5f;
            pedestrians[i].heading += 1.57f;
        }
    }
}

void Engine::handleCollisions() {
    // Vehicle to vehicle collision resolution
    for (int i = 0; i < MAX_VEHICLES; ++i) {
        if (!vehicles[i].active) continue;
        for (int j = i + 1; j < MAX_VEHICLES; ++j) {
            if (!vehicles[j].active) continue;

            float dx = vehicles[j].x - vehicles[i].x;
            float dz = vehicles[j].z - vehicles[i].z;
            float dist = std::sqrt(dx * dx + dz * dz);
            float minDist = getSpecs(vehicles[i].type).radius + getSpecs(vehicles[j].type).radius;

            if (dist < minDist && dist > 0.001f) {
                float overlap = (minDist - dist) * 0.5f;
                float nx = dx / dist;
                float nz = dz / dist;

                vehicles[i].x -= nx * overlap;
                vehicles[i].z -= nz * overlap;
                vehicles[j].x += nx * overlap;
                vehicles[j].z += nz * overlap;

                if (vehicles[i].isPlayer || vehicles[j].isPlayer) {
                    if (std::abs(vehicles[i].speed) > 40.0f || std::abs(vehicles[j].speed) > 40.0f) {
                        addWanted(1);
                    }
                }
            }
        }
    }
}

bool Engine::checkBuildingCollision(float x, float z, float radius) const {
    // Taipei 101 center plaza box check
    if (std::abs(x) < 32.0f + radius && std::abs(z) < 32.0f + radius) {
        return true;
    }
    // City block building footprints (avoid inside blocks off roads)
    float modX = std::fmod(std::abs(x), BLOCK_SIZE);
    float modZ = std::fmod(std::abs(z), BLOCK_SIZE);
    float halfRoad = ROAD_WIDTH * 0.5f;

    // Inside block (not on road)
    if (modX > halfRoad + 4.0f && modX < BLOCK_SIZE - halfRoad - 4.0f &&
        modZ > halfRoad + 4.0f && modZ < BLOCK_SIZE - halfRoad - 4.0f) {
        return true;
    }
    return false;
}

void Engine::addWanted(int32_t stars) {
    player.wantedLevel += stars;
    if (player.wantedLevel > 5) player.wantedLevel = 5;
}

const VehicleState& Engine::getVehicle(int32_t index) const {
    static VehicleState dummy{};
    if (index >= 0 && index < MAX_VEHICLES) return vehicles[index];
    return dummy;
}

VehicleState* Engine::getVehiclePtr(int32_t index) {
    if (index >= 0 && index < MAX_VEHICLES) return &vehicles[index];
    return nullptr;
}

const PedestrianState& Engine::getPedestrian(int32_t index) const {
    static PedestrianState dummy{};
    if (index >= 0 && index < MAX_PEDESTRIANS) return pedestrians[index];
    return dummy;
}

} // namespace TaipeiGTA

// External C WASM bridge implementations
extern "C" {
    void engine_init(uint32_t seed) {
        TaipeiGTA::g_engine.init(seed);
    }

    void engine_update(float dt, uint32_t inputMask, int32_t playerInVehicleReq) {
        TaipeiGTA::g_engine.update(dt, inputMask, playerInVehicleReq);
    }

    float engine_get_player_x() { return TaipeiGTA::g_engine.getPlayerX(); }
    float engine_get_player_y() { return TaipeiGTA::g_engine.getPlayerY(); }
    float engine_get_player_z() { return TaipeiGTA::g_engine.getPlayerZ(); }
    float engine_get_player_heading() { return TaipeiGTA::g_engine.getPlayerHeading(); }
    float engine_get_player_speed() { return TaipeiGTA::g_engine.getPlayerSpeed(); }
    int32_t engine_get_player_health() { return TaipeiGTA::g_engine.getPlayerHealth(); }
    int32_t engine_get_player_cash() { return TaipeiGTA::g_engine.getPlayerCash(); }
    int32_t engine_get_player_wanted() { return TaipeiGTA::g_engine.getPlayerWanted(); }
    int32_t engine_get_player_in_vehicle() { return TaipeiGTA::g_engine.getPlayerInVehicle(); }
    int32_t engine_get_player_vehicle_id() { return TaipeiGTA::g_engine.getPlayerVehicleId(); }

    int32_t engine_get_vehicle_count() { return TaipeiGTA::MAX_VEHICLES; }
    float engine_get_vehicle_data(int32_t index, int32_t field) {
        const auto& v = TaipeiGTA::g_engine.getVehicle(index);
        switch (field) {
            case 0: return static_cast<float>(v.active);
            case 1: return static_cast<float>(v.type);
            case 2: return v.x;
            case 3: return v.y;
            case 4: return v.z;
            case 5: return v.heading;
            case 6: return v.speed;
            case 7: return v.steerAngle;
            case 8: return v.leanAngle;
            case 9: return static_cast<float>(v.isPlayer);
            case 10: return static_cast<float>(v.isDrifting);
            case 11: return v.health;
            default: return 0.0f;
        }
    }

    int32_t engine_get_pedestrian_count() { return TaipeiGTA::MAX_PEDESTRIANS; }
    float engine_get_pedestrian_data(int32_t index, int32_t field) {
        const auto& p = TaipeiGTA::g_engine.getPedestrian(index);
        switch (field) {
            case 0: return static_cast<float>(p.active);
            case 1: return p.x;
            case 2: return p.z;
            case 3: return p.heading;
            case 4: return p.speed;
            case 5: return p.animTime;
            case 6: return static_cast<float>(p.health);
            default: return 0.0f;
        }
    }

    void engine_add_cash(int32_t amount) { TaipeiGTA::g_engine.addCash(amount); }
    void engine_add_wanted(int32_t stars) { TaipeiGTA::g_engine.addWanted(stars); }
    void engine_set_player_pos(float x, float z) { TaipeiGTA::g_engine.setPlayerPos(x, z); }
    void engine_toggle_vehicle() { TaipeiGTA::g_engine.triggerMountDismount(); }
}
