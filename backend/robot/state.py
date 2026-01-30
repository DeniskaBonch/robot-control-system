from pydantic import BaseModel
from typing import Dict

class RobotState(BaseModel):
    joints: Dict[str, float]
    status: str = "IDLE"
