import { useState, useEffect, useCallback } from "react";
import { RobotView } from "./components/RobotView";
import { analyzeRobotState, JOINT_LIMITS } from "./logic/robotSafety";
import type { JointName, RobotState } from "./logic/robotSafety";
import { connectWS, sendCommand } from "./services/ws";
import type { WsStatus } from "./services/ws";

interface LogEntry {
  id: number;
  time: string;
  kind: "info" | "warn" | "error" | "safety";
  text: string;
}

const ALL_JOINTS = Object.keys(JOINT_LIMITS) as JointName[];
const STATE_COLOR: Record<RobotState, string> = {
  OK: "#4caf50",
  WARNING: "#ff9800",
  CRITICAL: "#ff5722",
  BLOCKED: "#f44336",
};
const STATUS_COLOR: Record<WsStatus, string> = {
  connected: "#4caf50",
  disconnected: "#f44336",
  reconnecting: "#ff9800",
};
const STATUS_LABEL: Record<WsStatus, string> = {
  connected: "● Подключено",
  disconnected: "● Нет связи",
  reconnecting: "○ Переподключение...",
};

let _logId = 0;

export default function App() {
  const [realJoints, setRealJoints] = useState<Record<JointName, number>>(
    () =>
      Object.fromEntries(ALL_JOINTS.map((j) => [j, 0])) as Record<
        JointName,
        number
      >,
  );
  const [gripper, setGripper] = useState(0);
  const [robotStatus, setRobotStatus] = useState("IDLE");
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [trajectoryNames, setTrajectoryNames] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordName, setRecordName] = useState("");
  const [selectedTraj, setSelectedTraj] = useState("");

  const addLog = useCallback(
    (text: string, kind: LogEntry["kind"] = "info") => {
      const now = new Date().toLocaleTimeString("ru-RU");
      setLog((prev) =>
        [{ id: _logId++, time: now, kind, text }, ...prev].slice(0, 60),
      );
    },
    [],
  );

  useEffect(() => {
    connectWS(
      (data) => {
        if (data.joints) {
          setRealJoints(data.joints);
          if (data.status) setRobotStatus(data.status);
          if (typeof data.gripper === "number") setGripper(data.gripper);
        }
        if (data.type === "SAFETY_ALERT")
          addLog(`🛑 ${data.message}`, "safety");
        else if (data.type === "AI_WARNING")
          (data.messages as string[]).forEach((m) => addLog(`🤖 ${m}`, "warn"));
        else if (data.type === "ERROR") addLog(`❌ ${data.message}`, "error");
        else if (data.type === "INFO") addLog(data.message, "info");
        else if (
          data.type === "TRAJECTORY_SAVED" ||
          data.type === "TRAJECTORY_LIST"
        ) {
          if (data.names) setTrajectoryNames(data.names);
          if (data.type === "TRAJECTORY_SAVED")
            addLog(
              `💾 Траектория '${data.name}' сохранена (${data.frames} кадров)`,
              "info",
            );
        }
      },
      (status) => {
        setWsStatus(status);
        addLog(STATUS_LABEL[status], status === "connected" ? "info" : "warn");
      },
    );
  }, [addLog]);

  const setJoint = (name: JointName, angle: number) =>
    sendCommand({ type: "set_joint", joint: name, angle });
  const setGripperCmd = (value: number) =>
    sendCommand({ type: "set_gripper", value });
  const home = () => sendCommand({ type: "home" });

  const startRecording = () => {
    const name = recordName.trim() || `traj_${Date.now()}`;
    sendCommand({ type: "record_start", name });
    setIsRecording(true);
    addLog(`⏺ Запись начата: '${name}'`, "info");
  };
  const stopRecording = () => {
    sendCommand({ type: "record_stop" });
    setIsRecording(false);
  };
  const playTrajectory = () => {
    if (selectedTraj) sendCommand({ type: "play", name: selectedTraj });
  };
  const deleteTrajectory = () => {
    if (!selectedTraj) return;
    sendCommand({ type: "delete_trajectory", name: selectedTraj });
    setSelectedTraj("");
  };

  const safety = analyzeRobotState(realJoints);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "monospace",
        background: "#0d0d0d",
      }}
    >
      {/* ── ПАНЕЛЬ УПРАВЛЕНИЯ ── */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "#141414",
          color: "#e0e0e0",
          borderRight: "1px solid #2a2a2a",
          overflowY: "auto",
        }}
      >
        {/* статус */}
        <div
          style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: 14 }}>
              Robot Control
            </span>
            <span style={{ fontSize: 11, color: STATUS_COLOR[wsStatus] }}>
              {STATUS_LABEL[wsStatus]}
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 11, color: "#888" }}>Состояние:</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: "bold",
                color: STATE_COLOR[safety.state],
              }}
            >
              {safety.state}
            </span>
            <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
              {robotStatus}
            </span>
          </div>
        </div>

        {/* суставы */}
        <div
          style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a" }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#666",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Суставы
          </div>
          {ALL_JOINTS.map((name) => {
            const { min, max, label } = JOINT_LIMITS[name];
            const val = realJoints[name] ?? 0;
            const nearLimit =
              Math.abs(val - min) < 15 || Math.abs(max - val) < 15;
            return (
              <div key={name} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: nearLimit ? "#ff9800" : "#bbb",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: nearLimit ? "#ff9800" : "#e0e0e0",
                      fontWeight: "bold",
                    }}
                  >
                    {val.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={1}
                  value={val}
                  onChange={(e) => setJoint(name, Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: nearLimit ? "#ff9800" : "#4fc3f7",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#444",
                  }}
                >
                  <span>{min}°</span>
                  <span>{max}°</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* хват */}
        <div
          style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a" }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#666",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Хват (Gripper)
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 12, color: "#bbb" }}>
              {gripper === 0 ? "Открыт" : gripper === 1 ? "Закрыт" : "Частично"}
            </span>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>
              {(gripper * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gripper}
            onChange={(e) => setGripperCmd(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ce93d8" }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={() => setGripperCmd(0)}
              style={btnStyle("#1a2a1a", "#4caf50")}
            >
              Открыть
            </button>
            <button
              onClick={() => setGripperCmd(1)}
              style={btnStyle("#2a1a2a", "#ce93d8")}
            >
              Закрыть
            </button>
          </div>
        </div>

        {/* home */}
        <div
          style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a" }}
        >
          <button
            onClick={home}
            style={{ ...btnStyle("#1a1a2a", "#4fc3f7"), width: "100%" }}
          >
            🏠 В исходное положение (Home)
          </button>
        </div>

        {/* траектории */}
        <div
          style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a" }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#666",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Траектории
          </div>
          <input
            type="text"
            placeholder="Название траектории"
            value={recordName}
            onChange={(e) => setRecordName(e.target.value)}
            disabled={isRecording}
            style={inputStyle}
          />
          {!isRecording ? (
            <button
              onClick={startRecording}
              style={{
                ...btnStyle("#2a1a1a", "#ef5350"),
                width: "100%",
                marginTop: 6,
              }}
            >
              ⏺ Начать запись
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                ...btnStyle("#2a1a1a", "#ff8a65"),
                width: "100%",
                marginTop: 6,
              }}
            >
              ⏹ Остановить запись
            </button>
          )}
          {isRecording && (
            <div
              style={{
                fontSize: 11,
                color: "#ef5350",
                marginTop: 4,
                textAlign: "center",
              }}
            >
              ● REC
            </div>
          )}

          {trajectoryNames.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <select
                value={selectedTraj}
                onChange={(e) => setSelectedTraj(e.target.value)}
                style={{ ...inputStyle, marginBottom: 6 }}
              >
                <option value="">— выбрать траекторию —</option>
                {trajectoryNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={playTrajectory}
                  disabled={!selectedTraj}
                  style={{ ...btnStyle("#1a2a1a", "#66bb6a"), flex: 1 }}
                >
                  ▶ Играть
                </button>
                <button
                  onClick={deleteTrajectory}
                  disabled={!selectedTraj}
                  style={{ ...btnStyle("#2a1a1a", "#ef5350"), flex: 1 }}
                >
                  🗑 Удалить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* предупреждения */}
        {safety.warnings.length > 0 && (
          <div
            style={{ padding: "10px 16px", borderBottom: "1px solid #2a2a2a" }}
          >
            {safety.warnings.map((w, i) => (
              <div
                key={i}
                style={{ fontSize: 11, color: "#ff9800", marginBottom: 3 }}
              >
                {w}
              </div>
            ))}
          </div>
        )}

        {/* лог */}
        <div style={{ padding: "12px 16px", flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Лог
            </span>
            <button
              onClick={() => setLog([])}
              style={{
                fontSize: 10,
                color: "#444",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              очистить
            </button>
          </div>
          <div style={{ fontSize: 11, maxHeight: 180, overflowY: "auto" }}>
            {log.map((entry) => (
              <div
                key={entry.id}
                style={{ marginBottom: 3, color: logColor(entry.kind) }}
              >
                <span style={{ color: "#444" }}>[{entry.time}]</span>{" "}
                {entry.text}
              </div>
            ))}
            {log.length === 0 && (
              <div style={{ color: "#333" }}>Нет событий</div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3D вид ── */}
      <div
        style={{ flex: 1, minWidth: 0, height: "100vh", position: "relative" }}
      >
        <RobotView joints={realJoints} gripper={gripper} />
      </div>
    </div>
  );
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  border: `1px solid ${color}33`,
  borderRadius: 4,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "monospace",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e1e1e",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "5px 8px",
  color: "#e0e0e0",
  fontSize: 12,
  fontFamily: "monospace",
  boxSizing: "border-box",
};

const logColor = (kind: LogEntry["kind"]): string =>
  ({ info: "#888", warn: "#ff9800", error: "#f44336", safety: "#ff5722" })[
    kind
  ];
