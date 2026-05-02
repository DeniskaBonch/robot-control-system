from robot.state import RobotState
from safety.checker import check_joint_limits, SafetyException

# Аппаратные лимиты (жёсткие, от железа)
JOINT_LIMITS = {
    "joint0": (-180, 180),  # основание (поворот платформы)
    "joint1": (-90,  90),   # первое плечо
    "joint2": (-135, 135),  # второе плечо
    "joint3": (-90,  90),   # локоть
    "joint4": (-180, 180),  # запястье
}

GRIPPER_MIN = 0.0
GRIPPER_MAX = 1.0


class RobotSimulator:
    def __init__(self):
        self.state = RobotState(
            joints={j: 0.0 for j in JOINT_LIMITS},
            gripper=0.0,
            status="IDLE",
        )

    def move_joint(self, joint: str, delta: float):
        """Изменить угол сустава на delta градусов."""
        if joint not in self.state.joints:
            raise ValueError(f"Unknown joint: {joint}")

        current = self.state.joints[joint]
        new_value = current + delta

        min_lim, max_lim = JOINT_LIMITS[joint]
        if new_value < min_lim or new_value > max_lim:
            raise ValueError(
                f"Hardware limit exceeded on {joint}: "
                f"{new_value:.1f}° not in [{min_lim}, {max_lim}]"
            )

        check_joint_limits(joint, new_value)

        self.state.joints[joint] = round(new_value, 2)
        self.state.status = "MOVING"

    def set_joint(self, joint: str, angle: float):
        """Установить угол сустава напрямую (для воспроизведения траектории)."""
        if joint not in self.state.joints:
            raise ValueError(f"Unknown joint: {joint}")

        min_lim, max_lim = JOINT_LIMITS[joint]
        angle = max(min_lim, min(max_lim, angle))
        check_joint_limits(joint, angle)

        self.state.joints[joint] = round(angle, 2)
        self.state.status = "MOVING"

    def set_gripper(self, value: float):
        """Установить положение хвата: 0.0 = открыт, 1.0 = закрыт."""
        self.state.gripper = round(max(GRIPPER_MIN, min(GRIPPER_MAX, value)), 2)
        self.state.status = "MOVING"

    def home(self):
        """Вернуть всё в нулевое положение."""
        for joint in self.state.joints:
            self.state.joints[joint] = 0.0
        self.state.gripper = 0.0
        self.state.status = "IDLE"

    def get_state(self) -> RobotState:
        return self.state
