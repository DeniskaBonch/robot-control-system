import { useState, useEffect } from "react";
import { RobotView } from "./components/RobotView";
import { analyzeRobotState } from "./logic/robotSafety";
import type { JointName, RobotState } from "./logic/robotSafety";
import { connectWS, sendCommand } from "./services/ws";

export default function App() {
  /* ===== Реальное состояние от backend ===== */
  const [realJoints, setRealJoints] = useState<Record<JointName, number>>({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  /* ===== AI предупреждения ===== */
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);

  /* ===== WebSocket ===== */
  useEffect(() => {
    connectWS((data) => {
      // состояние робота
      if (data.joints) {
        setRealJoints(data.joints);
      }

      // AI предупреждения
      if (data.joints) {
        setRealJoints(data.joints);

        setServerWarnings([]);
      }

      // Safety ошибки
      if (data.type === "SAFETY_ALERT") {
        setServerWarnings((prev) => [...prev, data.message]);
      }
    });
  }, []);

  /* ===== ВАЖНО: анализируем РЕАЛЬНЫЕ данные ===== */
  const safety = analyzeRobotState(realJoints);

  /* ===== Отправка команды ===== */
  const moveJoint = (name: JointName, delta: number) => {
    sendCommand({
      type: "move",
      joint: name,
      delta,
    });
  };

  const stateColor: Record<RobotState, string> = {
    OK: "#4caf50",
    WARNING: "#ff9800",
    CRITICAL: "#ff5722",
    BLOCKED: "#f44336",
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* ===== ПАНЕЛЬ ===== */}
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

        {/* ===== КНОПКИ ===== */}
        {(["joint1", "joint2", "joint3"] as JointName[]).map((j) => (
          <div key={j} style={{ marginBottom: 12 }}>
            <div>{j}</div>
            <button onClick={() => moveJoint(j, 5)}>+</button>
            <button onClick={() => moveJoint(j, -5)}>-</button>
          </div>
        ))}

        <hr />

        {/* ===== ДАННЫЕ ===== */}
        <div>
          <strong>Реальные углы (backend)</strong>
          <pre>{JSON.stringify(realJoints, null, 2)}</pre>

          <strong>Безопасные (UI)</strong>
          <pre>{JSON.stringify(safety.safeJoints, null, 2)}</pre>
        </div>

        {/* ===== ЛОКАЛЬНЫЕ предупреждения ===== */}
        {safety.warnings.length > 0 && (
          <>
            <hr />
            <strong>Локальный анализ</strong>
            {safety.warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  marginTop: 6,
                  padding: 6,
                  background: "#ff9800",
                  borderRadius: 4,
                }}
              >
                ⚠ {w}
              </div>
            ))}
          </>
        )}

        {/* ===== СЕРВЕР ===== */}
        {serverWarnings.length > 0 && (
          <>
            <hr />
            <strong>AI (сервер)</strong>
            {serverWarnings.map((w, i) => (
              <div
                key={i}
                style={{
                  marginTop: 6,
                  padding: 6,
                  background: "#ff4444",
                  borderRadius: 4,
                }}
              >
                {w}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ===== 3D ===== */}
      <div style={{ flex: 1 }}>
        <RobotView joints={realJoints} />
      </div>
    </div>
  );
}