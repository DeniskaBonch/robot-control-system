import { useState } from "react";
import { RobotView } from "./components/RobotView";

export default function App() {
  const [joints, setJoints] = useState({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  const moveJoint = (name: string, delta: number) => {
    setJoints((prev) => ({
      ...prev,
      [name]: (prev as any)[name] + delta,
    }));
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Панель управления */}
      <div style={{ width: "300px", padding: "20px", background: "#111", color: "#fff" }}>
        <h2>Управление роботом</h2>

        <button onClick={() => moveJoint("joint1", 5)}>Joint1 +</button>
        <button onClick={() => moveJoint("joint1", -5)}>Joint1 -</button>

        <br /><br />

        <button onClick={() => moveJoint("joint2", 5)}>Joint2 +</button>
        <button onClick={() => moveJoint("joint2", -5)}>Joint2 -</button>

        <br /><br />

        <button onClick={() => moveJoint("joint3", 5)}>Joint3 +</button>
        <button onClick={() => moveJoint("joint3", -5)}>Joint3 -</button>

        <pre>{JSON.stringify(joints, null, 2)}</pre>
      </div>

      {/* 3D сцена */}
      <div style={{ flex: 1 }}>
        <RobotView joints={joints} />
      </div>
    </div>
  );
}
