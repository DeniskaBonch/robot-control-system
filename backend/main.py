import asyncio
import json
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from ws.manager import WebSocketManager
from robot.simulator import RobotSimulator
from robot.trajectory import TrajectoryRecorder
from safety.checker import SafetyException
from ai.analyzer import AIAnalyzer

app = FastAPI(title="Robot Control System")

manager   = WebSocketManager()
robot     = RobotSimulator()
recorder  = TrajectoryRecorder()
ai        = AIAnalyzer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "Backend is running"}


# ── helpers ──────────────────────────────────────────────────────────────────

async def _broadcast_state():
    state = robot.get_state()
    await manager.broadcast(state.json())


async def _broadcast_error(msg: str):
    await manager.broadcast(json.dumps({"type": "ERROR", "message": msg}))


async def _broadcast_info(msg: str):
    await manager.broadcast(json.dumps({"type": "INFO", "message": msg}))


# ── playback task ─────────────────────────────────────────────────────────────

async def _play_trajectory(name: str):
    traj = recorder.get(name)
    if not traj or not traj.frames:
        await _broadcast_error(f"Trajectory '{name}' not found or empty")
        return

    await _broadcast_info(f"▶ Playing trajectory '{name}' ({len(traj.frames)} frames)")

    prev_t = 0.0
    for frame in traj.frames:
        delay = frame.timestamp - prev_t
        if delay > 0:
            await asyncio.sleep(delay)
        prev_t = frame.timestamp

        for joint, angle in frame.joints.items():
            try:
                robot.set_joint(joint, angle)
            except (ValueError, SafetyException):
                pass

        robot.set_gripper(frame.gripper)
        await _broadcast_state()

    robot.state.status = "IDLE"
    await _broadcast_state()
    await _broadcast_info(f"✅ Trajectory '{name}' finished")


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await manager.send_personal(robot.get_state().json(), websocket)

    # отправить список сохранённых траекторий
    await manager.send_personal(
        json.dumps({"type": "TRAJECTORY_LIST", "names": recorder.list_names()}),
        websocket,
    )

    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            cmd_type = command.get("type")

            # ── move: delta ───────────────────────────────────────────────────
            if cmd_type == "move":
                try:
                    robot.move_joint(joint=command["joint"], delta=command["delta"])
                except SafetyException as e:
                    await manager.broadcast(
                        json.dumps({"type": "SAFETY_ALERT", "message": str(e)})
                    )
                    continue
                except ValueError as e:
                    await manager.send_personal(
                        json.dumps({"type": "ERROR", "message": str(e)}), websocket
                    )
                    continue

            # ── set_joint: прямое значение угла ──────────────────────────────
            elif cmd_type == "set_joint":
                try:
                    robot.set_joint(joint=command["joint"], angle=command["angle"])
                except (SafetyException, ValueError) as e:
                    await manager.send_personal(
                        json.dumps({"type": "ERROR", "message": str(e)}), websocket
                    )
                    continue

            # ── gripper ───────────────────────────────────────────────────────
            elif cmd_type == "set_gripper":
                robot.set_gripper(command.get("value", 0.0))

            # ── home ──────────────────────────────────────────────────────────
            elif cmd_type == "home":
                robot.home()
                await _broadcast_info("🏠 Robot moved to home position")

            # ── запись траектории ─────────────────────────────────────────────
            elif cmd_type == "record_start":
                name = command.get("name", f"traj_{int(time.time())}")
                recorder.start(name)
                await _broadcast_info(f"⏺ Recording started: '{name}'")

            elif cmd_type == "record_stop":
                traj = recorder.stop()
                if traj:
                    await manager.broadcast(
                        json.dumps({
                            "type": "TRAJECTORY_SAVED",
                            "name": traj.name,
                            "frames": len(traj.frames),
                            "names": recorder.list_names(),
                        })
                    )
                else:
                    await _broadcast_error("Not recording")
                continue  # не рассылаем состояние лишний раз

            # ── воспроизведение ───────────────────────────────────────────────
            elif cmd_type == "play":
                name = command.get("name", "")
                asyncio.create_task(_play_trajectory(name))
                continue

            # ── удалить траекторию ────────────────────────────────────────────
            elif cmd_type == "delete_trajectory":
                name = command.get("name", "")
                if recorder.delete(name):
                    await manager.broadcast(
                        json.dumps({
                            "type": "TRAJECTORY_LIST",
                            "names": recorder.list_names(),
                        })
                    )
                continue

            # ── AI-предупреждения ─────────────────────────────────────────────
            warnings = ai.analyze(command, robot.get_state())
            if warnings:
                await manager.broadcast(
                    json.dumps({"type": "AI_WARNING", "messages": warnings})
                )

            # ── запись кадра (если идёт запись) ──────────────────────────────
            state = robot.get_state()
            recorder.record_frame(state.joints, state.gripper)

            await _broadcast_state()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(json.dumps({"type": "INFO", "message": "Client disconnected"}))
