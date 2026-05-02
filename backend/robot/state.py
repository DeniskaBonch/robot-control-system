from pydantic import BaseModel
from typing import Dict

class RobotState(BaseModel):
    joints: Dict[str, float]
    gripper: float = 0.0   # 0.0 = открыт, 1.0 = закрыт
    status: str = "IDLE"
