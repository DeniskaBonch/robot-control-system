from typing import Dict, Tuple

# joint -> (min, max)
SAFE_ZONES: Dict[str, Tuple[float, float]] = {
    "joint1": (-180, 90),
    "joint2": (-90, 60),
    "joint3": (-135, 135),
}
