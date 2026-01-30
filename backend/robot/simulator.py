from robot.state import RobotState
from safety.checker import check_joint_limits, SafetyException

JOINT_LIMITS = {
    "joint1": (-180, 180),
    "joint2": (-90, 90),
    "joint3": (-135, 135),
}

class RobotSimulator:
    def __init__(self):
        self.state = RobotState(
            joints={
                "joint1": 0.0,
                "joint2": 0.0,
                "joint3": 0.0,
            },
            status="IDLE"
        )

    def move_joint(self, joint: str, delta: float):
        if joint not in self.state.joints:
            raise ValueError("Unknown joint")

        current = self.state.joints[joint]
        new_value = current + delta

        # 1️⃣ проверка аппаратных лимитов
        min_lim, max_lim = JOINT_LIMITS[joint]
        if new_value < min_lim or new_value > max_lim:
            raise ValueError("Hardware joint limit exceeded")

        # 2️⃣ проверка безопасной зоны
        check_joint_limits(joint, new_value)

        # 3️⃣ движение разрешено
        self.state.joints[joint] = new_value
        self.state.status = "MOVING"

    def get_state(self):
        return self.state
