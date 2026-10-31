// Engine.cs - High-Performance C# / .NET 8 WebAssembly Implementation of Taipei GTA Engine
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.JavaScript;

namespace TaipeiGTA
{
    public enum VehicleType
    {
        Scooter = 0,
        Taxi = 1,
        Truck = 2,
        Police = 3,
        Sports = 4
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct VehicleState
    {
        public int Id;
        public int Active;
        public int Type;
        public int IsPlayer;
        public int IsDrifting;
        public float X;
        public float Y;
        public float Z;
        public float Heading;
        public float Speed;
        public float SteerAngle;
        public float LeanAngle;
        public float Health;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PedestrianState
    {
        public int Id;
        public int Active;
        public float X;
        public float Z;
        public float Heading;
        public float Speed;
        public float AnimTime;
        public int Health;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PlayerState
    {
        public float X;
        public float Y;
        public float Z;
        public float Heading;
        public float Speed;
        public int Health;
        public int Cash;
        public int WantedLevel;
        public int InVehicle;
        public int VehicleId;
        public float SprintMultiplier;
    }

    public partial class GameEngine
    {
        public const int MaxVehicles = 32;
        public const int MaxPedestrians = 48;
        public const float WorldHalfSize = 600.0f;

        private static PlayerState _player;
        private static VehicleState[] _vehicles = new VehicleState[MaxVehicles];
        private static PedestrianState[] _pedestrians = new PedestrianState[MaxPedestrians];
        private static uint _rngSeed = 1337;

        private static float LcgRand(float min, float max)
        {
            _rngSeed = _rngSeed * 1664525u + 1013904223u;
            float norm = ((_rngSeed >> 8) & 0x00FFFFFF) / 16777215.0f;
            return min + norm * (max - min);
        }

        [JSExport]
        public static void Init(int seed)
        {
            _rngSeed = seed == 0 ? 123456789u : (uint)seed;

            _player = new PlayerState
            {
                X = 0f,
                Y = 0f,
                Z = 50f,
                Heading = 0f,
                Speed = 0f,
                Health = 100,
                Cash = 25800,
                WantedLevel = 0,
                InVehicle = 0,
                VehicleId = -1,
                SprintMultiplier = 1f
            };

            // Starter vehicles: Scooter, Taxi, Sports Car, Truck
            _vehicles[0] = new VehicleState { Id = 0, Active = 1, Type = 0, X = 3f, Y = 0f, Z = 50f, Heading = 1.57f, Health = 100f };
            _vehicles[1] = new VehicleState { Id = 1, Active = 1, Type = 1, X = -8f, Y = 0f, Z = 48f, Heading = 0f, Health = 100f };
            _vehicles[2] = new VehicleState { Id = 2, Active = 1, Type = 4, X = 8f, Y = 0f, Z = 48f, Heading = 0f, Health = 100f };
            _vehicles[3] = new VehicleState { Id = 3, Active = 1, Type = 2, X = -18f, Y = 0f, Z = 120f, Heading = 1.57f, Health = 100f };

            for (int i = 4; i < MaxVehicles; i++)
            {
                _vehicles[i] = new VehicleState
                {
                    Id = i,
                    Active = 1,
                    Type = i % 5,
                    X = (((i * 37) % 500) - 250f),
                    Y = 0f,
                    Z = (((i * 73) % 500) - 250f),
                    Heading = (i % 2 == 0) ? 0f : 1.57f,
                    Speed = LcgRand(15f, 35f),
                    Health = 100f
                };
            }

            for (int i = 0; i < MaxPedestrians; i++)
            {
                _pedestrians[i] = new PedestrianState
                {
                    Id = i,
                    Active = 1,
                    X = LcgRand(-350f, 350f),
                    Z = LcgRand(-350f, 350f),
                    Heading = LcgRand(0f, 6.28f),
                    Speed = LcgRand(1.5f, 3.5f),
                    AnimTime = LcgRand(0f, 10f),
                    Health = 100
                };
            }
        }

        [JSExport]
        public static void Update(float dt, int inputMask, int req)
        {
            float fDt = (dt <= 0f || dt > 0.1f) ? 0.01666f : dt;

            bool forward   = (inputMask & (1 << 0)) != 0;
            bool backward  = (inputMask & (1 << 1)) != 0;
            bool left      = (inputMask & (1 << 2)) != 0;
            bool right     = (inputMask & (1 << 3)) != 0;
            bool sprint    = (inputMask & (1 << 4)) != 0;
            bool handbrake = (inputMask & (1 << 5)) != 0;
            bool action    = (inputMask & (1 << 6)) != 0;

            if (action)
            {
                ToggleMount();
            }

            if (_player.InVehicle != 0 && _player.VehicleId >= 0 && _player.VehicleId < MaxVehicles)
            {
                ref var v = ref _vehicles[_player.VehicleId];
                _player.X = v.X;
                _player.Y = v.Y;
                _player.Z = v.Z;
                _player.Heading = v.Heading;
                _player.Speed = v.Speed;
            }
            else
            {
                float moveSpeed = sprint ? 12f : 6f;
                float targetSpeed = 0f;
                float steer = 0f;

                if (forward) targetSpeed += moveSpeed;
                if (backward) targetSpeed -= moveSpeed * 0.6f;
                if (left) steer -= 3.5f * fDt;
                if (right) steer += 3.5f * fDt;

                _player.Heading += steer;
                _player.Speed += (targetSpeed - _player.Speed) * 8f * fDt;

                _player.X += MathF.Sin(_player.Heading) * _player.Speed * fDt;
                _player.Z += MathF.Cos(_player.Heading) * _player.Speed * fDt;
            }

            // Update ambient vehicles
            for (int i = 0; i < MaxVehicles; i++)
            {
                if (_vehicles[i].Active == 0) continue;
                if (_vehicles[i].IsPlayer != 0)
                {
                    float accel = forward ? 30f : (backward ? -40f : 0f);
                    if (left) _vehicles[i].SteerAngle = MathF.Min(_vehicles[i].SteerAngle + 2.5f * fDt, 0.6f);
                    else if (right) _vehicles[i].SteerAngle = MathF.Max(_vehicles[i].SteerAngle - 2.5f * fDt, -0.6f);
                    else _vehicles[i].SteerAngle *= 0.85f;

                    _vehicles[i].IsDrifting = handbrake ? 1 : 0;
                    float drag = handbrake ? 0.96f : 0.985f;
                    _vehicles[i].Speed = (_vehicles[i].Speed + accel * fDt) * drag;
                    _vehicles[i].Heading += _vehicles[i].SteerAngle * (_vehicles[i].Speed / 100f) * 2.2f * fDt;

                    _vehicles[i].X += MathF.Sin(_vehicles[i].Heading) * (_vehicles[i].Speed * 0.277f) * fDt;
                    _vehicles[i].Z += MathF.Cos(_vehicles[i].Heading) * (_vehicles[i].Speed * 0.277f) * fDt;
                }
                else
                {
                    float spd = _vehicles[i].Speed;
                    _vehicles[i].X += MathF.Sin(_vehicles[i].Heading) * (spd * 0.277f) * fDt;
                    _vehicles[i].Z += MathF.Cos(_vehicles[i].Heading) * (spd * 0.277f) * fDt;
                    if (MathF.Abs(_vehicles[i].X) > WorldHalfSize - 20f || MathF.Abs(_vehicles[i].Z) > WorldHalfSize - 20f)
                    {
                        _vehicles[i].Heading += 3.14159f;
                    }
                }
            }
        }

        private static void ToggleMount()
        {
            if (_player.InVehicle != 0)
            {
                if (_player.VehicleId >= 0 && _player.VehicleId < MaxVehicles)
                {
                    _vehicles[_player.VehicleId].IsPlayer = 0;
                    _player.X = _vehicles[_player.VehicleId].X + MathF.Cos(_vehicles[_player.VehicleId].Heading + 1.57f) * 2.5f;
                    _player.Z = _vehicles[_player.VehicleId].Z + MathF.Sin(_vehicles[_player.VehicleId].Heading + 1.57f) * 2.5f;
                }
                _player.InVehicle = 0;
                _player.VehicleId = -1;
                _player.Speed = 0f;
            }
            else
            {
                float bestDist = 4.5f;
                int bestIdx = -1;
                for (int i = 0; i < MaxVehicles; i++)
                {
                    if (_vehicles[i].Active == 0) continue;
                    float dx = _vehicles[i].X - _player.X;
                    float dz = _vehicles[i].Z - _player.Z;
                    float dist = MathF.Sqrt(dx * dx + dz * dz);
                    if (dist < bestDist)
                    {
                        bestDist = dist;
                        bestIdx = i;
                    }
                }
                if (bestIdx >= 0)
                {
                    _player.InVehicle = 1;
                    _player.VehicleId = bestIdx;
                    _vehicles[bestIdx].IsPlayer = 1;
                }
            }
        }

        [JSExport]
        public static float GetPlayerX() => _player.X;
        [JSExport]
        public static float GetPlayerY() => _player.Y;
        [JSExport]
        public static float GetPlayerZ() => _player.Z;
        [JSExport]
        public static float GetPlayerHeading() => _player.Heading;
        [JSExport]
        public static float GetPlayerSpeed() => _player.Speed;
        [JSExport]
        public static int GetPlayerCash() => _player.Cash;
        [JSExport]
        public static int GetPlayerWanted() => _player.WantedLevel;
    }
}
