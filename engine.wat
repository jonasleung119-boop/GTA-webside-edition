(module
  ;; Taipei GTA Core WebAssembly Simulation Engine
  ;; Implements player mechanics, vehicle physics, traffic AI, and memory buffer
  (import "env" "sin" (func $sin (param f32) (result f32)))
  (import "env" "cos" (func $cos (param f32) (result f32)))
  (memory (export "memory") 1)

  ;; Memory offsets
  ;; 0: Player (x, y, z, heading, speed, health, cash, wanted, in_vehicle, vehicle_id)
  ;; 64: Vehicles [32] * 48 bytes
  ;; 1600: Pedestrians [48] * 28 bytes
  ;; 3000: RNG Seed (i32)

  ;; Helper: Pseudo-random LCG
  (func $rand (result f32)
    (local $seed i32)
    (local.set $seed (i32.load (i32.const 3000)))
    (local.set $seed (i32.add (i32.mul (local.get $seed) (i32.const 1664525)) (i32.const 1013904223)))
    (i32.store (i32.const 3000) (local.get $seed))
    (f32.div
      (f32.convert_i32_u (i32.and (i32.shr_u (local.get $seed) (i32.const 8)) (i32.const 65535)))
      (f32.const 65535.0))
  )

  ;; Exported: engine_init(seed)
  (func $engine_init (param $seed i32)
    (local $i i32)
    (local $v_ptr i32)
    (local $p_ptr i32)

    ;; Store seed
    (if (i32.eqz (local.get $seed))
      (then (local.set $seed (i32.const 123456789))))
    (i32.store (i32.const 3000) (local.get $seed))

    ;; Init player
    (f32.store (i32.const 0) (f32.const 0.0))    ;; x
    (f32.store (i32.const 4) (f32.const 0.0))    ;; y
    (f32.store (i32.const 8) (f32.const 50.0))   ;; z
    (f32.store (i32.const 12) (f32.const 0.0))   ;; heading
    (f32.store (i32.const 16) (f32.const 0.0))   ;; speed
    (i32.store (i32.const 20) (i32.const 100))   ;; health
    (i32.store (i32.const 24) (i32.const 25800)) ;; cash
    (i32.store (i32.const 28) (i32.const 0))     ;; wanted
    (i32.store (i32.const 32) (i32.const 0))     ;; in_vehicle
    (i32.store (i32.const 36) (i32.const -1))    ;; vehicle_id

    ;; Starter 0: Scooter
    (i32.store (i32.const 64) (i32.const 1))
    (i32.store (i32.const 68) (i32.const 0)) ;; Scooter
    (f32.store (i32.const 72) (f32.const 3.0))
    (f32.store (i32.const 76) (f32.const 0.0))
    (f32.store (i32.const 80) (f32.const 50.0))
    (f32.store (i32.const 84) (f32.const 1.57079))
    (f32.store (i32.const 88) (f32.const 0.0))
    (f32.store (i32.const 92) (f32.const 0.0))
    (f32.store (i32.const 96) (f32.const 0.0))
    (i32.store (i32.const 100) (i32.const 0)) ;; is_player
    (i32.store (i32.const 104) (i32.const 0))
    (f32.store (i32.const 108) (f32.const 100.0))

    ;; Starter 1: Yellow Taxi
    (i32.store (i32.const 112) (i32.const 1))
    (i32.store (i32.const 116) (i32.const 1)) ;; Taxi
    (f32.store (i32.const 120) (f32.const -8.0))
    (f32.store (i32.const 124) (f32.const 0.0))
    (f32.store (i32.const 128) (f32.const 48.0))
    (f32.store (i32.const 132) (f32.const 0.0))
    (f32.store (i32.const 136) (f32.const 0.0))
    (f32.store (i32.const 140) (f32.const 0.0))
    (f32.store (i32.const 144) (f32.const 0.0))
    (i32.store (i32.const 148) (i32.const 0))
    (i32.store (i32.const 152) (i32.const 0))
    (f32.store (i32.const 156) (f32.const 100.0))

    ;; Starter 2: Sports Car
    (i32.store (i32.const 160) (i32.const 1))
    (i32.store (i32.const 164) (i32.const 4)) ;; Sports
    (f32.store (i32.const 168) (f32.const 8.0))
    (f32.store (i32.const 172) (f32.const 0.0))
    (f32.store (i32.const 176) (f32.const 48.0))
    (f32.store (i32.const 180) (f32.const 0.0))
    (f32.store (i32.const 184) (f32.const 0.0))
    (f32.store (i32.const 188) (f32.const 0.0))
    (f32.store (i32.const 192) (f32.const 0.0))
    (i32.store (i32.const 196) (i32.const 0))
    (i32.store (i32.const 200) (i32.const 0))
    (f32.store (i32.const 204) (f32.const 100.0))

    ;; Starter 3: Blue Truck
    (i32.store (i32.const 208) (i32.const 1))
    (i32.store (i32.const 212) (i32.const 2)) ;; Truck
    (f32.store (i32.const 216) (f32.const -18.0))
    (f32.store (i32.const 220) (f32.const 0.0))
    (f32.store (i32.const 224) (f32.const 120.0))
    (f32.store (i32.const 228) (f32.const 1.57079))
    (f32.store (i32.const 232) (f32.const 0.0))
    (f32.store (i32.const 236) (f32.const 0.0))
    (f32.store (i32.const 240) (f32.const 0.0))
    (i32.store (i32.const 244) (i32.const 0))
    (i32.store (i32.const 248) (i32.const 0))
    (f32.store (i32.const 252) (f32.const 100.0))

    ;; Traffic vehicles 4..31
    (local.set $i (i32.const 4))
    (loop $v_loop
      (local.set $v_ptr (i32.add (i32.const 64) (i32.mul (local.get $i) (i32.const 48))))
      (i32.store (local.get $v_ptr) (i32.const 1)) ;; active
      (i32.store (i32.add (local.get $v_ptr) (i32.const 4)) (i32.rem_u (local.get $i) (i32.const 5))) ;; type
      (f32.store (i32.add (local.get $v_ptr) (i32.const 8))
        (f32.sub (f32.mul (call $rand) (f32.const 500.0)) (f32.const 250.0))) ;; x
      (f32.store (i32.add (local.get $v_ptr) (i32.const 12)) (f32.const 0.0)) ;; y
      (f32.store (i32.add (local.get $v_ptr) (i32.const 16))
        (f32.sub (f32.mul (call $rand) (f32.const 500.0)) (f32.const 250.0))) ;; z
      (f32.store (i32.add (local.get $v_ptr) (i32.const 20))
        (select (f32.const 1.57079) (f32.const 0.0) (i32.rem_u (local.get $i) (i32.const 2)))) ;; heading
      (f32.store (i32.add (local.get $v_ptr) (i32.const 24))
        (f32.add (f32.const 20.0) (f32.mul (call $rand) (f32.const 20.0)))) ;; speed
      (f32.store (i32.add (local.get $v_ptr) (i32.const 28)) (f32.const 0.0)) ;; steer
      (f32.store (i32.add (local.get $v_ptr) (i32.const 32)) (f32.const 0.0)) ;; lean
      (i32.store (i32.add (local.get $v_ptr) (i32.const 36)) (i32.const 0))   ;; is_player
      (i32.store (i32.add (local.get $v_ptr) (i32.const 40)) (i32.const 0))   ;; is_drifting
      (f32.store (i32.add (local.get $v_ptr) (i32.const 44)) (f32.const 100.0)) ;; health

      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $v_loop (i32.lt_u (local.get $i) (i32.const 32)))
    )

    ;; Pedestrians 0..47
    (local.set $i (i32.const 0))
    (loop $p_loop
      (local.set $p_ptr (i32.add (i32.const 1600) (i32.mul (local.get $i) (i32.const 28))))
      (i32.store (local.get $p_ptr) (i32.const 1)) ;; active
      (f32.store (i32.add (local.get $p_ptr) (i32.const 4))
        (f32.sub (f32.mul (call $rand) (f32.const 600.0)) (f32.const 300.0))) ;; x
      (f32.store (i32.add (local.get $p_ptr) (i32.const 8))
        (f32.sub (f32.mul (call $rand) (f32.const 600.0)) (f32.const 300.0))) ;; z
      (f32.store (i32.add (local.get $p_ptr) (i32.const 12))
        (f32.mul (call $rand) (f32.const 6.28318))) ;; heading
      (f32.store (i32.add (local.get $p_ptr) (i32.const 16))
        (f32.add (f32.const 1.6) (f32.mul (call $rand) (f32.const 2.0)))) ;; speed
      (f32.store (i32.add (local.get $p_ptr) (i32.const 20))
        (f32.mul (call $rand) (f32.const 10.0))) ;; anim_time
      (i32.store (i32.add (local.get $p_ptr) (i32.const 24)) (i32.const 100)) ;; health

      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $p_loop (i32.lt_u (local.get $i) (i32.const 48)))
    )
  )

  ;; Exported: engine_toggle_vehicle()
  (func $engine_toggle_vehicle
    (local $in_v i32)
    (local $vid i32)
    (local $v_ptr i32)
    (local $i i32)
    (local $px f32)
    (local $pz f32)
    (local $best_dist f32)
    (local $best_idx i32)
    (local $dx f32)
    (local $dz f32)
    (local $dist f32)

    (local.set $in_v (i32.load (i32.const 32)))
    (if (local.get $in_v)
      (then
        ;; Dismount
        (local.set $vid (i32.load (i32.const 36)))
        (if (i32.ge_s (local.get $vid) (i32.const 0))
          (then
            (local.set $v_ptr (i32.add (i32.const 64) (i32.mul (local.get $vid) (i32.const 48))))
            (i32.store (i32.add (local.get $v_ptr) (i32.const 36)) (i32.const 0)) ;; is_player = 0
            (f32.store (i32.const 0) (f32.add (f32.load (i32.add (local.get $v_ptr) (i32.const 8))) (f32.const 2.5)))
            (f32.store (i32.const 8) (f32.load (i32.add (local.get $v_ptr) (i32.const 16))))
          )
        )
        (i32.store (i32.const 32) (i32.const 0))
        (i32.store (i32.const 36) (i32.const -1))
        (f32.store (i32.const 16) (f32.const 0.0))
      )
      (else
        ;; Mount nearest vehicle within 5.5m
        (local.set $px (f32.load (i32.const 0)))
        (local.set $pz (f32.load (i32.const 8)))
        (local.set $best_dist (f32.const 5.5))
        (local.set $best_idx (i32.const -1))

        (local.set $i (i32.const 0))
        (loop $search_v
          (local.set $v_ptr (i32.add (i32.const 64) (i32.mul (local.get $i) (i32.const 48))))
          (if (i32.load (local.get $v_ptr))
            (then
              (local.set $dx (f32.sub (f32.load (i32.add (local.get $v_ptr) (i32.const 8))) (local.get $px)))
              (local.set $dz (f32.sub (f32.load (i32.add (local.get $v_ptr) (i32.const 16))) (local.get $pz)))
              (local.set $dist (f32.sqrt (f32.add (f32.mul (local.get $dx) (local.get $dx)) (f32.mul (local.get $dz) (local.get $dz)))))
              (if (f32.lt (local.get $dist) (local.get $best_dist))
                (then
                  (local.set $best_dist (local.get $dist))
                  (local.set $best_idx (local.get $i))
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $search_v (i32.lt_u (local.get $i) (i32.const 32)))
        )

        (if (i32.ge_s (local.get $best_idx) (i32.const 0))
          (then
            (i32.store (i32.const 32) (i32.const 1))
            (i32.store (i32.const 36) (local.get $best_idx))
            (local.set $v_ptr (i32.add (i32.const 64) (i32.mul (local.get $best_idx) (i32.const 48))))
            (i32.store (i32.add (local.get $v_ptr) (i32.const 36)) (i32.const 1))
          )
        )
      )
    )
  )

  ;; Exported: engine_update(dt, input_mask, req)
  (func $engine_update (param $dt f32) (param $input i32) (param $req i32)
    (local $in_v i32)
    (local $vid i32)
    (local $v_ptr i32)
    (local $fwd i32)
    (local $bwd i32)
    (local $left i32)
    (local $right i32)
    (local $sprint i32)
    (local $brake i32)
    (local $act i32)
    (local $speed f32)
    (local $heading f32)
    (local $steer f32)
    (local $target_spd f32)
    (local $i i32)
    (local $p_ptr i32)

    ;; Clamp dt
    (if (f32.le (local.get $dt) (f32.const 0.0))
      (then (local.set $dt (f32.const 0.01666))))
    (if (f32.gt (local.get $dt) (f32.const 0.1))
      (then (local.set $dt (f32.const 0.01666))))

    ;; Parse input bits
    (local.set $fwd (i32.and (local.get $input) (i32.const 1)))
    (local.set $bwd (i32.and (local.get $input) (i32.const 2)))
    (local.set $left (i32.and (local.get $input) (i32.const 4)))
    (local.set $right (i32.and (local.get $input) (i32.const 8)))
    (local.set $sprint (i32.and (local.get $input) (i32.const 16)))
    (local.set $brake (i32.and (local.get $input) (i32.const 32)))
    (local.set $act (i32.and (local.get $input) (i32.const 64)))

    (if (local.get $act)
      (then (call $engine_toggle_vehicle)))

    (local.set $in_v (i32.load (i32.const 32)))
    (if (local.get $in_v)
      (then
        ;; Player is in vehicle
        (local.set $vid (i32.load (i32.const 36)))
        (if (i32.ge_s (local.get $vid) (i32.const 0))
          (then
            (local.set $v_ptr (i32.add (i32.const 64) (i32.mul (local.get $vid) (i32.const 48))))
            (local.set $speed (f32.load (i32.add (local.get $v_ptr) (i32.const 24))))
            (local.set $heading (f32.load (i32.add (local.get $v_ptr) (i32.const 20))))
            (local.set $steer (f32.load (i32.add (local.get $v_ptr) (i32.const 28))))

            ;; Steer
            (if (local.get $left)
              (then (local.set $steer (f32.add (local.get $steer) (f32.mul (f32.const 2.8) (local.get $dt)))))
              (else (if (local.get $right)
                (then (local.set $steer (f32.sub (local.get $steer) (f32.mul (f32.const 2.8) (local.get $dt)))))
                (else (local.set $steer (f32.mul (local.get $steer) (f32.const 0.86))))
              ))
            )

            ;; Clamp steer
            (if (f32.gt (local.get $steer) (f32.const 0.6))
              (then (local.set $steer (f32.const 0.6))))
            (if (f32.lt (local.get $steer) (f32.const -0.6))
              (then (local.set $steer (f32.const -0.6))))
            (f32.store (i32.add (local.get $v_ptr) (i32.const 28)) (local.get $steer))

            ;; Accel / Brake
            (if (local.get $fwd)
              (then (local.set $speed (f32.add (local.get $speed) (f32.mul (f32.const 32.0) (local.get $dt))))))
            (if (local.get $bwd)
              (then (local.set $speed (f32.sub (local.get $speed) (f32.mul (f32.const 42.0) (local.get $dt))))))

            ;; Drag
            (if (local.get $brake)
              (then
                (local.set $speed (f32.mul (local.get $speed) (f32.const 0.95)))
                (i32.store (i32.add (local.get $v_ptr) (i32.const 40)) (i32.const 1)) ;; is_drifting
              )
              (else
                (local.set $speed (f32.mul (local.get $speed) (f32.const 0.988)))
                (i32.store (i32.add (local.get $v_ptr) (i32.const 40)) (i32.const 0))
              )
            )

            ;; Turn heading
            (local.set $heading (f32.add (local.get $heading)
              (f32.mul (f32.mul (local.get $steer) (f32.div (local.get $speed) (f32.const 70.0)))
                       (f32.mul (f32.const 2.2) (local.get $dt)))))
            (f32.store (i32.add (local.get $v_ptr) (i32.const 20)) (local.get $heading))
            (f32.store (i32.add (local.get $v_ptr) (i32.const 24)) (local.get $speed))

            ;; Scooter lean angle
            (if (i32.eqz (i32.load (i32.add (local.get $v_ptr) (i32.const 4))))
              (then
                (f32.store (i32.add (local.get $v_ptr) (i32.const 32))
                  (f32.mul (f32.neg (local.get $steer)) (f32.const 0.45)))
              )
            )

            ;; Update position
            (f32.store (i32.add (local.get $v_ptr) (i32.const 8))
              (f32.add (f32.load (i32.add (local.get $v_ptr) (i32.const 8)))
                (f32.mul (call $sin (local.get $heading)) (f32.mul (f32.mul (local.get $speed) (f32.const 0.277)) (local.get $dt)))))
            (f32.store (i32.add (local.get $v_ptr) (i32.const 16))
              (f32.add (f32.load (i32.add (local.get $v_ptr) (i32.const 16)))
                (f32.mul (call $cos (local.get $heading)) (f32.mul (f32.mul (local.get $speed) (f32.const 0.277)) (local.get $dt)))))

            ;; Sync to player
            (f32.store (i32.const 0) (f32.load (i32.add (local.get $v_ptr) (i32.const 8))))
            (f32.store (i32.const 4) (f32.load (i32.add (local.get $v_ptr) (i32.const 12))))
            (f32.store (i32.const 8) (f32.load (i32.add (local.get $v_ptr) (i32.const 16))))
            (f32.store (i32.const 12) (local.get $heading))
            (f32.store (i32.const 16) (local.get $speed))
          )
        )
      )
      (else
        ;; Player on foot
        (local.set $speed (f32.load (i32.const 16)))
        (local.set $heading (f32.load (i32.const 12)))
        (local.set $target_spd (select (f32.const 12.0) (f32.const 6.0) (local.get $sprint)))

        (if (local.get $left)
          (then (local.set $heading (f32.add (local.get $heading) (f32.mul (f32.const 3.5) (local.get $dt))))))
        (if (local.get $right)
          (then (local.set $heading (f32.sub (local.get $heading) (f32.mul (f32.const 3.5) (local.get $dt))))))
        (f32.store (i32.const 12) (local.get $heading))

        (if (local.get $fwd)
          (then (local.set $speed (f32.add (local.get $speed)
            (f32.mul (f32.sub (local.get $target_spd) (local.get $speed)) (f32.mul (f32.const 8.0) (local.get $dt))))))
          (else (if (local.get $bwd)
            (then (local.set $speed (f32.sub (local.get $speed)
              (f32.mul (f32.add (f32.mul (local.get $target_spd) (f32.const 0.6)) (local.get $speed)) (f32.mul (f32.const 8.0) (local.get $dt))))))
            (else (local.set $speed (f32.mul (local.get $speed) (f32.const 0.82))))
          ))
        )
        (f32.store (i32.const 16) (local.get $speed))

        (f32.store (i32.const 0)
          (f32.add (f32.load (i32.const 0))
            (f32.mul (call $sin (local.get $heading)) (f32.mul (local.get $speed) (local.get $dt)))))
        (f32.store (i32.const 8)
          (f32.add (f32.load (i32.const 8))
            (f32.mul (call $cos (local.get $heading)) (f32.mul (local.get $speed) (local.get $dt)))))
      )
    )

    ;; Ambient traffic motion
    (local.set $i (i32.const 0))
    (loop $update_traffic
      (local.set $v_ptr (i32.add (i32.const 64) (i32.mul (local.get $i) (i32.const 48))))
      (if (i32.and (i32.load (local.get $v_ptr)) (i32.eqz (i32.load (i32.add (local.get $v_ptr) (i32.const 36)))))
        (then
          (local.set $speed (f32.load (i32.add (local.get $v_ptr) (i32.const 24))))
          (local.set $heading (f32.load (i32.add (local.get $v_ptr) (i32.const 20))))

          (f32.store (i32.add (local.get $v_ptr) (i32.const 8))
            (f32.add (f32.load (i32.add (local.get $v_ptr) (i32.const 8)))
              (f32.mul (call $sin (local.get $heading)) (f32.mul (f32.mul (local.get $speed) (f32.const 0.277)) (local.get $dt)))))
          (f32.store (i32.add (local.get $v_ptr) (i32.const 16))
            (f32.add (f32.load (i32.add (local.get $v_ptr) (i32.const 16)))
              (f32.mul (call $cos (local.get $heading)) (f32.mul (f32.mul (local.get $speed) (f32.const 0.277)) (local.get $dt)))))

          ;; Bounds turnaround
          (if (f32.gt (f32.abs (f32.load (i32.add (local.get $v_ptr) (i32.const 8)))) (f32.const 550.0))
            (then (f32.store (i32.add (local.get $v_ptr) (i32.const 20)) (f32.add (local.get $heading) (f32.const 3.14159)))))
          (if (f32.gt (f32.abs (f32.load (i32.add (local.get $v_ptr) (i32.const 16)))) (f32.const 550.0))
            (then (f32.store (i32.add (local.get $v_ptr) (i32.const 20)) (f32.add (local.get $heading) (f32.const 3.14159)))))
        )
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $update_traffic (i32.lt_u (local.get $i) (i32.const 32)))
    )

    ;; Pedestrians motion
    (local.set $i (i32.const 0))
    (loop $update_ped
      (local.set $p_ptr (i32.add (i32.const 1600) (i32.mul (local.get $i) (i32.const 28))))
      (if (i32.load (local.get $p_ptr))
        (then
          ;; Anim time
          (f32.store (i32.add (local.get $p_ptr) (i32.const 20))
            (f32.add (f32.load (i32.add (local.get $p_ptr) (i32.const 20))) (f32.mul (local.get $dt) (f32.const 6.0))))

          (local.set $speed (f32.load (i32.add (local.get $p_ptr) (i32.const 16))))
          (local.set $heading (f32.load (i32.add (local.get $p_ptr) (i32.const 12))))

          (f32.store (i32.add (local.get $p_ptr) (i32.const 4))
            (f32.add (f32.load (i32.add (local.get $p_ptr) (i32.const 4)))
              (f32.mul (call $sin (local.get $heading)) (f32.mul (local.get $speed) (local.get $dt)))))
          (f32.store (i32.add (local.get $p_ptr) (i32.const 8))
            (f32.add (f32.load (i32.add (local.get $p_ptr) (i32.const 8)))
              (f32.mul (call $cos (local.get $heading)) (f32.mul (local.get $speed) (local.get $dt)))))

          (if (f32.gt (f32.abs (f32.load (i32.add (local.get $p_ptr) (i32.const 4)))) (f32.const 500.0))
            (then (f32.store (i32.add (local.get $p_ptr) (i32.const 12)) (f32.add (local.get $heading) (f32.const 3.14159)))))
        )
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $update_ped (i32.lt_u (local.get $i) (i32.const 48)))
    )
  )

  ;; Exported getters
  (func (export "engine_get_player_x") (result f32) (f32.load (i32.const 0)))
  (func (export "engine_get_player_y") (result f32) (f32.load (i32.const 4)))
  (func (export "engine_get_player_z") (result f32) (f32.load (i32.const 8)))
  (func (export "engine_get_player_heading") (result f32) (f32.load (i32.const 12)))
  (func (export "engine_get_player_speed") (result f32) (f32.load (i32.const 16)))
  (func (export "engine_get_player_health") (result i32) (i32.load (i32.const 20)))
  (func (export "engine_get_player_cash") (result i32) (i32.load (i32.const 24)))
  (func (export "engine_get_player_wanted") (result i32) (i32.load (i32.const 28)))
  (func (export "engine_get_player_in_vehicle") (result i32) (i32.load (i32.const 32)))
  (func (export "engine_get_player_vehicle_id") (result i32) (i32.load (i32.const 36)))

  (func (export "engine_get_vehicle_count") (result i32) (i32.const 32))
  (func (export "engine_get_vehicle_data") (param $idx i32) (param $field i32) (result f32)
    (local $ptr i32)
    (if (i32.ge_u (local.get $idx) (i32.const 32)) (then (return (f32.const 0.0))))
    (local.set $ptr (i32.add (i32.const 64) (i32.mul (local.get $idx) (i32.const 48))))
    (if (i32.eq (local.get $field) (i32.const 0)) (then (return (f32.convert_i32_s (i32.load (local.get $ptr))))))
    (if (i32.eq (local.get $field) (i32.const 1)) (then (return (f32.convert_i32_s (i32.load (i32.add (local.get $ptr) (i32.const 4)))))))
    (if (i32.eq (local.get $field) (i32.const 2)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 8))))))
    (if (i32.eq (local.get $field) (i32.const 3)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 12))))))
    (if (i32.eq (local.get $field) (i32.const 4)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 16))))))
    (if (i32.eq (local.get $field) (i32.const 5)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 20))))))
    (if (i32.eq (local.get $field) (i32.const 6)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 24))))))
    (if (i32.eq (local.get $field) (i32.const 7)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 28))))))
    (if (i32.eq (local.get $field) (i32.const 8)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 32))))))
    (if (i32.eq (local.get $field) (i32.const 9)) (then (return (f32.convert_i32_s (i32.load (i32.add (local.get $ptr) (i32.const 36)))))))
    (if (i32.eq (local.get $field) (i32.const 10)) (then (return (f32.convert_i32_s (i32.load (i32.add (local.get $ptr) (i32.const 40)))))))
    (if (i32.eq (local.get $field) (i32.const 11)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 44))))))
    (f32.const 0.0)
  )

  (func (export "engine_get_pedestrian_count") (result i32) (i32.const 48))
  (func (export "engine_get_pedestrian_data") (param $idx i32) (param $field i32) (result f32)
    (local $ptr i32)
    (if (i32.ge_u (local.get $idx) (i32.const 48)) (then (return (f32.const 0.0))))
    (local.set $ptr (i32.add (i32.const 1600) (i32.mul (local.get $idx) (i32.const 28))))
    (if (i32.eq (local.get $field) (i32.const 0)) (then (return (f32.convert_i32_s (i32.load (local.get $ptr))))))
    (if (i32.eq (local.get $field) (i32.const 1)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 4))))))
    (if (i32.eq (local.get $field) (i32.const 2)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 8))))))
    (if (i32.eq (local.get $field) (i32.const 3)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 12))))))
    (if (i32.eq (local.get $field) (i32.const 4)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 16))))))
    (if (i32.eq (local.get $field) (i32.const 5)) (then (return (f32.load (i32.add (local.get $ptr) (i32.const 20))))))
    (if (i32.eq (local.get $field) (i32.const 6)) (then (return (f32.convert_i32_s (i32.load (i32.add (local.get $ptr) (i32.const 24)))))))
    (f32.const 0.0)
  )

  (func (export "engine_add_cash") (param $amt i32)
    (i32.store (i32.const 24) (i32.add (i32.load (i32.const 24)) (local.get $amt)))
  )

  (func (export "engine_add_wanted") (param $stars i32)
    (local $w i32)
    (local.set $w (i32.add (i32.load (i32.const 28)) (local.get $stars)))
    (if (i32.gt_s (local.get $w) (i32.const 5)) (then (local.set $w (i32.const 5))))
    (i32.store (i32.const 28) (local.get $w))
  )

  (func (export "engine_set_player_pos") (param $x f32) (param $z f32)
    (f32.store (i32.const 0) (local.get $x))
    (f32.store (i32.const 8) (local.get $z))
  )

  (export "engine_init" (func $engine_init))
  (export "engine_update" (func $engine_update))
  (export "engine_toggle_vehicle" (func $engine_toggle_vehicle))
)
