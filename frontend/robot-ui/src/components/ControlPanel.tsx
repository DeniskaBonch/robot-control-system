import React from "react";
import { sendCommand } from "../services/socket";

interface ControlPanelProps {}

export const ControlPanel: React.FC<ControlPanelProps> = () => {
  const move = (joint: string, delta: number) => {
    sendCommand({ type: "move", joint, delta });
  };

  return (
    <div>
      <button onClick={() => move("joint1", 5)}>Joint1 +5°</button>
      <button onClick={() => move("joint1", -5)}>Joint1 -5°</button>
      <button onClick={() => move("joint2", 5)}>Joint2 +5°</button>
      <button onClick={() => move("joint2", -5)}>Joint2 -5°</button>
    </div>
  );
};
