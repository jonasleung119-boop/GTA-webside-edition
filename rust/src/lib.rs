// lib.rs - High-Performance Rust Implementation of Taipei GTA Simulation Engine
// Compiles directly to wasm32-unknown-unknown target for native WebAssembly speed.

#![no_std]

// Core math support in no_std
extern crate alloc;

#[repr(C)]
#[derive(Clone, Copy)]
pub enum VehicleType {
    Scooter = 0,
    Taxi    = 1,
    Truck   = 2,
    Police  = 3,
    Sports  = 4,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct VehicleState {
    pub id: i32,
    pub active: i32,
    pub v_type: i32,
    pub is_player: i32,
    pub is_drifting: i32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub heading: f32,
    pub speed: f32,
    pub steer_angle: f32,
    pub lean_angle: f32,
    pub health: f32,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct PedestrianState {
    pub id: i32,
    pub active: i32,
    pub x: f32,
    pub z: f32,
    pub heading: f32,
    pub speed: f32,
    pub anim_time: f32,
    pub health: i32,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct PlayerState {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub heading: f32,
    pub speed: f32,
    pub health: i32,
    pub cash: i32,
    pub wanted_level: i32,
    pub in_vehicle: i32,
    pub vehicle_id: i32,
    pub sprint_multiplier: f32,
}

pub const MAX_VEHICLES: usize = 32;
pub const MAX_PEDESTRIANS: usize = 48;
pub const WORLD_HALF_SIZE: f32 = 600.0;
pub const BLOCK_SIZE: f32 = 120.0;
pub const ROAD_WIDTH: f32 = 24.0;

pub struct Engine {
    pub player: PlayerState,
    pub vehicles: [VehicleState; MAX_VEHICLES],
    pub pedestrians: [PedestrianState; MAX_PEDESTRIANS],
    pub rng_seed: u32,
    pub prev_action: bool,
}

impl Engine {
    pub const fn new() -> Self {
        const DEFAULT_VEHICLE: VehicleState = VehicleState {
            id: 0,
            active: 0,
            v_type: 0,
            is_player: 0,
            is_drifting: 0,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            heading: 0.0,
            speed: 0.0,
            steer_angle: 0.0,
            lean_angle: 0.0,
            health: 100.0,
        };

        const DEFAULT_PEDESTRIAN: PedestrianState = PedestrianState {
            id: 0,
            active: 0,
            x: 0.0,
            z: 0.0,
            heading: 0.0,
            speed: 0.0,
            anim_time: 0.0,
            health: 100,
        };

        Self {
            player: PlayerState {
                x: 0.0,
                y: 0.0,
                z: 50.0,
                heading: 0.0,
                speed: 0.0,
                health: 100,
                cash: 25800,
                wanted_level: 0,
                in_vehicle: 0,
                vehicle_id: -1,
                sprint_multiplier: 1.0,
            },
            vehicles: [DEFAULT_VEHICLE; MAX_VEHICLES],
            pedestrians: [DEFAULT_PEDESTRIAN; MAX_PEDESTRIANS],
            rng_seed: 1337,
            prev_action: false,
        }
    }

    fn lcg_rand(&mut self, min: f32, max: f32) -> f32 {
        self.rng_seed = self.rng_seed.wrapping_mul(1664525).wrapping_add(1013904223);
        let norm = ((self.rng_seed >> 8) & 0x00FFFFFF) as f32 / 16777215.0;
        min + norm * (max - min)
    }

    pub fn init(&mut self, seed: u32) {
        self.rng_seed = if seed == 0 { 123456789 } else { seed };

        self.player.x = 0.0;
        self.player.y = 0.0;
        self.player.z = 50.0;
        self.player.heading = 0.0;
        self.player.speed = 0.0;
        self.player.health = 100;
        self.player.cash = 25800;
        self.player.wanted_level = 0;
        self.player.in_vehicle = 0;
        self.player.vehicle_id = -1;

        // Starter vehicles: Scooter, Taxi, Sports Car, Blue Truck
        self.vehicles[0] = VehicleState { id: 0, active: 1, v_type: 0, is_player: 0, is_drifting: 0, x: 3.0, y: 0.0, z: 50.0, heading: 1.57079, speed: 0.0, steer_angle: 0.0, lean_angle: 0.0, health: 100.0 };
        self.vehicles[1] = VehicleState { id: 1, active: 1, v_type: 1, is_player: 0, is_drifting: 0, x: -8.0, y: 0.0, z: 48.0, heading: 0.0, speed: 0.0, steer_angle: 0.0, lean_angle: 0.0, health: 100.0 };
        self.vehicles[2] = VehicleState { id: 2, active: 1, v_type: 4, is_player: 0, is_drifting: 0, x: 8.0, y: 0.0, z: 48.0, heading: 0.0, speed: 0.0, steer_angle: 0.0, lean_angle: 0.0, health: 100.0 };
        self.vehicles[3] = VehicleState { id: 3, active: 1, v_type: 2, is_player: 0, is_drifting: 0, x: -18.0, y: 0.0, z: 120.0, heading: 1.57079, speed: 0.0, steer_angle: 0.0, lean_angle: 0.0, health: 100.0 };

        for i in 4..MAX_VEHICLES {
            let v_type = (i % 5) as i32;
            let rx = (((i * 37) % 500) as f32) - 250.0;
            let rz = (((i * 73) % 500) as f32) - 250.0;
            let heading = if i % 2 == 0 { 0.0 } else { 1.57079 };
            let speed = self.lcg_rand(15.0, 35.0);

            self.vehicles[i] = VehicleState {
                id: i as i32,
                active: 1,
                v_type,
                is_player: 0,
                is_drifting: 0,
                x: rx,
                y: 0.0,
                z: rz,
                heading,
                speed,
                steer_angle: 0.0,
                lean_angle: 0.0,
                health: 100.0,
            };
        }

        for i in 0..MAX_PEDESTRIANS {
            let px = self.lcg_rand(-350.0, 350.0);
            let pz = self.lcg_rand(-350.0, 350.0);
            let heading = self.lcg_rand(0.0, 6.28318);
            let speed = self.lcg_rand(1.5, 3.5);
            let anim_time = self.lcg_rand(0.0, 10.0);

            self.pedestrians[i] = PedestrianState {
                id: i as i32,
                active: 1,
                x: px,
                z: pz,
                heading,
                speed,
                anim_time,
                health: 100,
            };
        }
    }

    pub fn update(&mut self, dt: f32, input_mask: u32, _req: i32) {
        let f_dt = if dt <= 0.0 || dt > 0.1 { 0.01666 } else { dt };

        let forward   = (input_mask & (1 << 0)) != 0;
        let backward  = (input_mask & (1 << 1)) != 0;
        let left      = (input_mask & (1 << 2)) != 0;
        let right     = (input_mask & (1 << 3)) != 0;
        let sprint    = (input_mask & (1 << 4)) != 0;
        let handbrake = (input_mask & (1 << 5)) != 0;
        let action    = (input_mask & (1 << 6)) != 0;

        if action && !self.prev_action {
            self.toggle_mount();
        }
        self.prev_action = action;

        if self.player.in_vehicle != 0 {
            let vid = self.player.vehicle_id as usize;
            if vid < MAX_VEHICLES {
                self.player.x = self.vehicles[vid].x;
                self.player.y = self.vehicles[vid].y;
                self.player.z = self.vehicles[vid].z;
                self.player.heading = self.vehicles[vid].heading;
                self.player.speed = self.vehicles[vid].speed;
            }
        } else {
            let move_speed = if sprint { 12.0 } else { 6.0 };
            let mut target_speed = 0.0f32;
            let mut steer = 0.0f32;

            if forward { target_speed += move_speed; }
            if backward { target_speed -= move_speed * 0.6; }
            if left { steer -= 3.5 * f_dt; }
            if right { steer += 3.5 * f_dt; }

            self.player.heading += steer;
            self.player.speed += (target_speed - self.player.speed) * 8.0 * f_dt;

            let nx = self.player.x + self.player.heading.sin() * self.player.speed * f_dt;
            let nz = self.player.z + self.player.heading.cos() * self.player.speed * f_dt;
            self.player.x = nx;
            self.player.z = nz;
        }

        // Vehicles update
        for i in 0..MAX_VEHICLES {
            if self.vehicles[i].active == 0 { continue; }
            if self.vehicles[i].is_player != 0 {
                let accel = if forward { 30.0 } else if backward { -40.0 } else { 0.0 };
                if left { self.vehicles[i].steer_angle = (self.vehicles[i].steer_angle + 2.5 * f_dt).min(0.6); }
                else if right { self.vehicles[i].steer_angle = (self.vehicles[i].steer_angle - 2.5 * f_dt).max(-0.6); }
                else { self.vehicles[i].steer_angle *= 0.85; }

                self.vehicles[i].is_drifting = if handbrake { 1 } else { 0 };
                let drag = if handbrake { 0.96 } else { 0.985 };
                self.vehicles[i].speed = (self.vehicles[i].speed + accel * f_dt) * drag;
                self.vehicles[i].heading += self.vehicles[i].steer_angle * (self.vehicles[i].speed / 100.0) * 2.2 * f_dt;

                self.vehicles[i].x += self.vehicles[i].heading.sin() * (self.vehicles[i].speed * 0.277) * f_dt;
                self.vehicles[i].z += self.vehicles[i].heading.cos() * (self.vehicles[i].speed * 0.277) * f_dt;
            } else {
                let spd = self.vehicles[i].speed;
                self.vehicles[i].x += self.vehicles[i].heading.sin() * (spd * 0.277) * f_dt;
                self.vehicles[i].z += self.vehicles[i].heading.cos() * (spd * 0.277) * f_dt;
                if self.vehicles[i].x.abs() > WORLD_HALF_SIZE - 20.0 || self.vehicles[i].z.abs() > WORLD_HALF_SIZE - 20.0 {
                    self.vehicles[i].heading += 3.14159;
                }
            }
        }

        // Pedestrians update
        for i in 0..MAX_PEDESTRIANS {
            if self.pedestrians[i].active == 0 { continue; }
            self.pedestrians[i].anim_time += f_dt * 6.0;
            self.pedestrians[i].x += self.pedestrians[i].heading.sin() * self.pedestrians[i].speed * f_dt;
            self.pedestrians[i].z += self.pedestrians[i].heading.cos() * self.pedestrians[i].speed * f_dt;
            if self.pedestrians[i].x.abs() > WORLD_HALF_SIZE - 30.0 || self.pedestrians[i].z.abs() > WORLD_HALF_SIZE - 30.0 {
                self.pedestrians[i].heading += 3.14159;
            }
        }
    }

    pub fn toggle_mount(&mut self) {
        if self.player.in_vehicle != 0 {
            let vid = self.player.vehicle_id as usize;
            if vid < MAX_VEHICLES {
                self.vehicles[vid].is_player = 0;
                self.player.x = self.vehicles[vid].x + (self.vehicles[vid].heading + 1.57).cos() * 2.5;
                self.player.z = self.vehicles[vid].z + (self.vehicles[vid].heading + 1.57).sin() * 2.5;
            }
            self.player.in_vehicle = 0;
            self.player.vehicle_id = -1;
            self.player.speed = 0.0;
        } else {
            let mut best_dist = 4.5f32;
            let mut best_idx = -1i32;
            for i in 0..MAX_VEHICLES {
                if self.vehicles[i].active == 0 { continue; }
                let dx = self.vehicles[i].x - self.player.x;
                let dz = self.vehicles[i].z - self.player.z;
                let dist = (dx * dx + dz * dz).sqrt();
                if dist < best_dist {
                    best_dist = dist;
                    best_idx = i as i32;
                }
            }
            if best_idx >= 0 {
                self.player.in_vehicle = 1;
                self.player.vehicle_id = best_idx;
                self.vehicles[best_idx as usize].is_player = 1;
            }
        }
    }
}

static mut GLOBAL_ENGINE: Engine = Engine::new();

#[no_mangle]
pub extern "C" fn rust_engine_init(seed: u32) {
    unsafe { GLOBAL_ENGINE.init(seed); }
}

#[no_mangle]
pub extern "C" fn rust_engine_update(dt: f32, input_mask: u32, req: i32) {
    unsafe { GLOBAL_ENGINE.update(dt, input_mask, req); }
}

#[no_mangle]
pub extern "C" fn rust_engine_get_player_x() -> f32 { unsafe { GLOBAL_ENGINE.player.x } }
#[no_mangle]
pub extern "C" fn rust_engine_get_player_y() -> f32 { unsafe { GLOBAL_ENGINE.player.y } }
#[no_mangle]
pub extern "C" fn rust_engine_get_player_z() -> f32 { unsafe { GLOBAL_ENGINE.player.z } }
#[no_mangle]
pub extern "C" fn rust_engine_get_player_speed() -> f32 { unsafe { GLOBAL_ENGINE.player.speed } }
#[no_mangle]
pub extern "C" fn rust_engine_get_player_cash() -> i32 { unsafe { GLOBAL_ENGINE.player.cash } }
#[no_mangle]
pub extern "C" fn rust_engine_get_player_wanted() -> i32 { unsafe { GLOBAL_ENGINE.player.wanted_level } }
