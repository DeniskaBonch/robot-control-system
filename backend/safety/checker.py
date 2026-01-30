from safety.zone import SAFE_ZONES

class SafetyException(Exception):
    pass

def check_joint_limits(joint: str, value: float):
    if joint not in SAFE_ZONES:
        raise SafetyException("Unknown joint")

    min_safe, max_safe = SAFE_ZONES[joint]

    if value < min_safe or value > max_safe:
        raise SafetyException(
            f"Safety zone violation on {joint}: {value}°"
        )
