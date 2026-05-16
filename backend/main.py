from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import uuid
import json
import os
from engine import GameState

app = FastAPI()

# Store games in memory: room_id -> GameState
games = {}
# Store connections: room_id -> { "p1": WebSocket, "p2": WebSocket }
connections = {}

@app.post("/api/new")
def create_game():
    room_id = str(uuid.uuid4())[:8]
    games[room_id] = GameState(is_ai=False)
    connections[room_id] = {}
    return {"room_id": room_id, "join_url_p1": f"/?room={room_id}&player=p1", "join_url_p2": f"/?room={room_id}&player=p2"}

@app.post("/api/new-ai")
def create_game_ai():
    room_id = str(uuid.uuid4())[:8]
    games[room_id] = GameState(is_ai=True)
    connections[room_id] = {}
    return {"room_id": room_id, "join_url_p1": f"/?room={room_id}&player=p1"}

@app.get("/api/games")
def list_games():
    active_games = []
    for room_id, game in games.items():
        active_games.append({
            "room_id": room_id,
            "turn": game.turn,
            "turn_count": getattr(game, 'turn_count', 0),
            "winner": game.winner
        })
    return {"games": active_games}

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await websocket.accept()
    
    if room_id not in games:
        await websocket.send_json({"error": "Sala não encontrada. Verifique o código ou se a sala ainda existe."})
        await websocket.close()
        return
        
    if player_id == "spectator":
        player_id = f"spectator_{uuid.uuid4().hex[:8]}"
        
    if player_id not in ["p1", "p2"] and not player_id.startswith("spectator"):
        await websocket.send_json({"error": "ID de jogador inválido."})
        await websocket.close()
        return
        
    if player_id in ["p1", "p2"] and player_id in connections[room_id]:
        await websocket.send_json({"error": f"Jogador {player_id} já está conectado nesta sala."})
        await websocket.close()
        return
        
    connections[room_id][player_id] = websocket
    
    # Send current state
    game = games[room_id]
    await broadcast_state(room_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "move":
                    from_pos = message.get("from")
                    to_pos = message.get("to")
                    card = message.get("card")
                    
                    if from_pos is not None and to_pos is not None and card:
                        success = game.move(
                            player_id, 
                            from_pos[0], from_pos[1], 
                            to_pos[0], to_pos[1], 
                            card
                        )
                        if success:
                            await broadcast_state(room_id)
                            
                            # Logica do turno da IA
                            if getattr(game, 'is_ai', False) and game.turn == "p2" and not game.winner:
                                import asyncio
                                await asyncio.sleep(1.0) # Delay para o jogador humano ver a sua própria jogada antes de tomar porrada
                                ai_move = game.get_ai_move()
                                if ai_move:
                                    fr, fc, tr, tc, ai_card = ai_move
                                    game.move("p2", fr, fc, tr, tc, ai_card)
                                    await broadcast_state(room_id)
                        else:
                            await websocket.send_json({"error": "Invalid move"})
                            
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        if room_id in connections and player_id in connections[room_id]:
            del connections[room_id][player_id]
        if room_id in connections and not connections[room_id]:
            # Clean up empty rooms
            del connections[room_id]
            # Optional: delete game if both left
            # if room_id in games: del games[room_id]
            
async def broadcast_state(room_id: str):
    if room_id in games and room_id in connections:
        state = games[room_id].to_dict()
        connected_players = list(connections[room_id].keys())
        
        for player_id, ws in connections[room_id].items():
            try:
                await ws.send_json({
                    "type": "state",
                    "player": player_id,
                    "connected_players": connected_players,
                    "state": state
                })
            except Exception as e:
                print(f"Error broadcasting to {player_id}: {e}")

# Mount static files at the root
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
