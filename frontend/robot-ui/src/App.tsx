import { useState } from "react";
import { RobotView } from "./components/RobotView";

/* ===== Типы ===== */

type JointName = "joint1" | "joint2" | "joint3";

type JointsState = Record<JointName, number>;

/* ===== Ограничения (ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ) ===== */

const JOINT_LIMITS: Record<JointName, { min: number; max: number }> = {
  joint1: { min: -90, max: 90 },
  joint2: { min: -60, max: 60 },
  joint3: { min: -45, max: 45 },
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ===== App ===== */

export default function App() {
  const [joints, setJoints] = useState<JointsState>({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  const moveJoint = (name: JointName, delta: number) => {
    setJoints((prev) => {
      const nextRaw = prev[name] + delta;
      const limits = JOINT_LIMITS[name];

      const nextClamped = clamp(
        nextRaw,
        limits.min,
        limits.max
      );

      return {
        ...prev,
        [name]: nextClamped,
      };
    });
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* ===== Панель управления ===== */}
      <div
        style={{
          width: "300px",
          padding: "20px",
          background: "#111",
          color: "#fff",
          fontFamily: "monospace",
        }}
      >
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

      {/* ===== 3D сцена ===== */}
      <div style={{ flex: 1 }}>
        <RobotView joints={joints} />
      </div>
    </div>
  );
}
