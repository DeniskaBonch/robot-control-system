from typing import Dict, Tuple

# Программные зоны безопасности (чуть уже аппаратных лимитов)
SAFE_ZONES: Dict[str, Tuple[float, float]] = {
    "joint0": (-170, 170),
    "joint1": (-85,  85),
    "joint2": (-120, 120),
    "joint3": (-85,  85),
    "joint4": (-170, 170),
}
