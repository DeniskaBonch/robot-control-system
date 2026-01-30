from ai.memory import OperatorMemory

class AIAnalyzer:
    def __init__(self):
        self.memory = OperatorMemory()

    def analyze(self, command: dict, robot_state):
        self.memory.add(command)

        warnings = []

        # 1️⃣ слишком резкие движения
        if abs(command.get("delta", 0)) > 20:
            warnings.append(
                "Резкое движение сустава. Рекомендуется уменьшить шаг."
            )

        # 2️⃣ приближение к границе безопасности
        joint = command.get("joint")
        if joint:
            value = robot_state.joints[joint]
            if abs(value) > 0.8 * 90:
                warnings.append(
                    f"Сустав {joint} близок к опасной зоне."
                )

        return warnings
