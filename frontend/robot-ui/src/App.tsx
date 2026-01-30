import { useState } from "react";
import { RobotView } from "./components/RobotView";
import { analyzeRobotState } from "./logic/robotSafety";
import type { JointName, RobotState } from "./logic/robotSafety";


export default function App() {
  /* ===== Сырые углы от пользователя ===== */
  const [rawJoints, setRawJoints] = useState<Record<JointName, number>>({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  /* ===== Результат анализа безопасности ===== */
  const safety = analyzeRobotState(rawJoints);

  /* ===== Движение сустава ===== */
  const moveJoint = (name: JointName, delta: number) => {
    setRawJoints((prev) => ({
      ...prev,
      [name]: prev[name] + delta,
    }));
  };

  /* ===== Цвет состояния ===== */
  const stateColor: Record<RobotState, string> = {
    OK: "#4caf50",
    WARNING: "#ff9800",
    CRITICAL: "#ff5722",
    BLOCKED: "#f44336",
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* ===== Панель управления ===== */}
      <div
        style={{
          width: "320px",
          padding: "20px",
          background: "#111",
          color: "#fff",
          fontFamily: "monospace",
        }}
      >
        <h2>Управление роботом</h2>

        <div style={{ marginBottom: 12 }}>
          <strong>Состояние:</strong>{" "}
          <span style={{ color: stateColor[safety.state] }}>
            {safety.state}
          </span>
        </div>

        {/* ===== Кнопки ===== */}
        {(["joint1", "joint2", "joint3"] as JointName[]).map((j) => (
          <div key={j} style={{ marginBottom: 12 }}>
            <div>{j}</div>
            <button onClick={() => moveJoint(j, 5)}>+</button>
            <button onClick={() => moveJoint(j, -5)}>-</button>
          </div>
        ))}

        <hr />

        {/* ===== Значения ===== */}
        <div>
          <strong>Запрошенные углы (UI)</strong>
          <pre>{JSON.stringify(rawJoints, null, 2)}</pre>

          <strong>Безопасные углы (робот)</strong>
          <pre>{JSON.stringify(safety.safeJoints, null, 2)}</pre>
        </div>

        {/* ===== Предупреждения ===== */}
        {safety.warnings.length > 0 && (
          <>
            <hr />
            <strong>AI предупреждения</strong>
            {safety.warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  marginTop: 6,
                  padding: 6,
                  background: "#ff4444",
                  borderRadius: 4,
                }}
              >
                ⚠ {w}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ===== 3D сцена ===== */}
      <div style={{ flex: 1 }}>
        <RobotView joints={safety.safeJoints} />
      </div>
    </div>
  );
}
