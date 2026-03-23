/* ===== Типы ===== */

export type JointName = "joint1" | "joint2" | "joint3";

export type RobotState =
  | "OK"
  | "WARNING"
  | "CRITICAL"
  | "BLOCKED";

export interface JointLimits {
  min: number;
  max: number;
}

export interface SafetyResult {
  state: RobotState;
  warnings: string[];
  safeJoints: Record<JointName, number>;
}

/* ===== Ограничения суставов ===== */

export const JOINT_LIMITS: Record<JointName, JointLimits> = {
  joint1: { min: -90, max: 90 },
  joint2: { min: -60, max: 60 },
  joint3: { min: -45, max: 45 },
};

const WARNING_ZONE = 15; // градусов до предела

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ===== Основная логика ===== */

export function analyzeRobotState(
  joints: Record<JointName, number>
): SafetyResult {
  const warnings: string[] = [];
  let state: RobotState = "OK";

  const safeJoints = { ...joints } as Record<JointName, number>;

  (Object.keys(JOINT_LIMITS) as JointName[]).forEach((name) => {
    const { min, max } = JOINT_LIMITS[name];
    const value = joints[name];

    const clamped = clamp(value, min, max);
    safeJoints[name] = clamped;

    const nearMin = Math.abs(value - min) <= WARNING_ZONE;
    const nearMax = Math.abs(max - value) <= WARNING_ZONE;

    if (value < min || value > max) {
      state = "BLOCKED";
      warnings.push(`⛔ Сустав ${name} вышел за пределы`);
    } else if (nearMin || nearMax) {
      if (state !== "BLOCKED") state = "WARNING";
      warnings.push(`⚠ Сустав ${name} близок к пределу`);
    }
  });

  if (warnings.length === 0) {
    state = "OK";
  }

  return { state, warnings, safeJoints };
}
