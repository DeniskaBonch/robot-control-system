"""
Модуль записи и воспроизведения траекторий.

Траектория — список кадров (keyframes).
Каждый кадр: { joints: {...}, gripper: float, timestamp: float }
"""

import time
from typing import List, Dict, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class Keyframe:
    joints: Dict[str, float]
    gripper: float
    timestamp: float  # секунды от начала записи


@dataclass
class Trajectory:
    name: str
    frames: List[Keyframe] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)

    def add_frame(self, joints: Dict[str, float], gripper: float, t: float):
        self.frames.append(Keyframe(joints=dict(joints), gripper=gripper, timestamp=t))

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "created_at": self.created_at,
            "frames": [asdict(f) for f in self.frames],
        }

    @staticmethod
    def from_dict(data: dict) -> "Trajectory":
        t = Trajectory(name=data["name"], created_at=data.get("created_at", 0))
        for f in data.get("frames", []):
            t.frames.append(Keyframe(**f))
        return t


class TrajectoryRecorder:
    """Управляет записью и хранением траекторий (in-memory)."""

    def __init__(self):
        self._recording: Optional[Trajectory] = None
        self._record_start: float = 0.0
        self._last_frame_time: float = 0.0
        self.MIN_INTERVAL = 0.1          # минимум 100 мс между кадрами
        self.saved: Dict[str, Trajectory] = {}  # name -> Trajectory

    # ---------- запись ----------

    def start(self, name: str):
        self._recording = Trajectory(name=name)
        self._record_start = time.time()
        self._last_frame_time = 0.0

    def record_frame(self, joints: Dict[str, float], gripper: float) -> bool:
        """Добавить кадр, если прошло достаточно времени. Возвращает True если кадр добавлен."""
        if self._recording is None:
            return False
        now = time.time()
        t = now - self._record_start
        if t - self._last_frame_time < self.MIN_INTERVAL:
            return False
        self._recording.add_frame(joints, gripper, round(t, 3))
        self._last_frame_time = t
        return True

    def stop(self) -> Optional[Trajectory]:
        """Завершить запись и сохранить траекторию."""
        if self._recording is None:
            return None
        traj = self._recording
        self.saved[traj.name] = traj
        self._recording = None
        return traj

    def is_recording(self) -> bool:
        return self._recording is not None

    def current_name(self) -> Optional[str]:
        return self._recording.name if self._recording else None

    # ---------- воспроизведение ----------

    def get(self, name: str) -> Optional[Trajectory]:
        return self.saved.get(name)

    def list_names(self) -> List[str]:
        return list(self.saved.keys())

    def delete(self, name: str) -> bool:
        if name in self.saved:
            del self.saved[name]
            return True
        return False
