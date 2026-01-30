from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json

from ws.manager import WebSocketManager
from robot.simulator import RobotSimulator
from safety.checker import SafetyException
from ai.analyzer import AIAnalyzer



app = FastAPI(title="Robot Control System")

# --- Инициализация ---
manager = WebSocketManager()
robot = RobotSimulator()
ai = AIAnalyzer()


# --- CORS ---
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

# --- WebSocket ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    # сразу отправляем текущее состояние при подключении
    await manager.send_personal(robot.get_state().json(), websocket)

    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)

            if command.get("type") == "move":
                try:
                    robot.move_joint(
                        joint=command["joint"],
                        delta=command["delta"]
                    )
                except SafetyException as se:
                    await manager.broadcast(
                        json.dumps({
                            "type": "SAFETY_ALERT",
                            "message": str(se)
                        })
                    )
                    continue
                except ValueError as e:
                    await manager.send_personal(
                        json.dumps({"error": str(e)}),
                        websocket
                    )
                    continue

            if command.get("type") == "move":
                try:
                    robot.move_joint(
                        joint=command["joint"],
                        delta=command["delta"]
                    )
                except ValueError as e:
                    await manager.send_personal(
                        json.dumps({"error": str(e)}),
                        websocket
                    )
                    continue
            warnings = ai.analyze(command, robot.get_state())

            if warnings:
                await manager.broadcast(
                    json.dumps({
                        "type": "AI_WARNING",
                        "messages": warnings
                    })
                )

            # после ЛЮБОЙ команды рассылаем состояние
            state = robot.get_state()
            await manager.broadcast(state.json())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(
            json.dumps({"info": "Client disconnected"})
        )