import random
from typing import List, Dict, Tuple, Optional

# Card definitions: (dx, dy)
# dx: - is left, + is right
# dy: - is forward (up the board for P1), + is backward
CARDS = {
    "Tigre": [(0, -2), (0, 1)],
    "Dragão": [(-2, -1), (2, -1), (-1, 1), (1, 1)],
    "Sapo": [(-2, 0), (-1, -1), (1, 1)],
    "Coelho": [(1, -1), (2, 0), (-1, 1)],
    "Caranguejo": [(-2, 0), (2, 0), (0, -1)],
    "Elefante": [(-1, -1), (1, -1), (-1, 0), (1, 0)],
    "Ganso": [(-1, -1), (-1, 0), (1, 0), (1, 1)],
    "Galo": [(1, -1), (-1, 0), (1, 0), (-1, 1)],
    "Macaco": [(-1, -1), (1, -1), (-1, 1), (1, 1)],
    "Louva-a-deus": [(-1, -1), (1, -1), (0, 1)],
    "Cavalo": [(0, -1), (-1, 0), (0, 1)],
    "Boi": [(0, -1), (1, 0), (0, 1)],
    "Garça": [(0, -1), (-1, 1), (1, 1)],
    "Javali": [(-1, 0), (1, 0), (0, -1)],
    "Enguia": [(-1, -1), (-1, 1), (1, 0)],
    "Cobra": [(1, -1), (1, 1), (-1, 0)]
}

class GameState:
    def __init__(self, is_ai=False):
        self.is_ai = is_ai
        # 5x5 board
        # p1: player 1 (bottom), p2: player 2 (top)
        # s: student, m: master
        # Board coordinates: row 0 is top (p2 side), row 4 is bottom (p1 side)
        self.board = [
            ["s2", "s2", "m2", "s2", "s2"],
            ["", "", "", "", ""],
            ["", "", "", "", ""],
            ["", "", "", "", ""],
            ["s1", "s1", "m1", "s1", "s1"]
        ]
        
        # Draw 5 random cards
        deck = list(CARDS.keys())
        random.shuffle(deck)
        drawn = deck[:5]
        
        self.p1_cards = [drawn[0], drawn[1]]
        self.p2_cards = [drawn[2], drawn[3]]
        self.neutral_card = drawn[4]
        
        # Sorteio do primeiro a jogar (50% de chance para cada lado)
        self.turn = "p1" if random.random() > 0.5 else "p2"
        self.winner = None
        self.last_action = None
        self.turn_count = 0

    def get_valid_moves(self, player: str, row: int, col: int) -> List[Tuple[int, int, str]]:
        """
        Returns a list of (target_row, target_col, card_name)
        """
        if self.winner:
            return []
            
        piece = self.board[row][col]
        if not piece.endswith(player[1]):
            return []

        valid_moves = []
        cards = self.p1_cards if player == "p1" else self.p2_cards
        
        for card_name in cards:
            moves = CARDS[card_name]
            for dx, dy in moves:
                # For P2, the board is flipped from their perspective
                if player == "p2":
                    dx = -dx
                    dy = -dy
                
                target_row = row + dy
                target_col = col + dx
                
                if 0 <= target_row < 5 and 0 <= target_col < 5:
                    target_piece = self.board[target_row][target_col]
                    if not target_piece.endswith(player[1]):
                        valid_moves.append((target_row, target_col, card_name))
                        
        return valid_moves

    def move(self, player: str, from_row: int, from_col: int, to_row: int, to_col: int, card_name: str) -> bool:
        if self.winner or self.turn != player:
            return False
            
        cards = self.p1_cards if player == "p1" else self.p2_cards
        if card_name not in cards:
            return False
            
        valid_moves = self.get_valid_moves(player, from_row, from_col)
        if (to_row, to_col, card_name) not in valid_moves:
            return False
            
        moving_piece = self.board[from_row][from_col]
        target_piece = self.board[to_row][to_col]
        captured = target_piece != ""
        
        # Make the move
        self.board[to_row][to_col] = moving_piece
        self.board[from_row][from_col] = ""
        
        self.turn_count += 1
        self.last_action = {
            "type": "move",
            "captured": captured,
            "card": card_name,
            "id": self.turn_count
        }
        
        # Check Win Conditions
        # 1. Way of the Stone (capture enemy master)
        if target_piece == "m2":
            self.winner = "p1"
        elif target_piece == "m1":
            self.winner = "p2"
            
        # 2. Way of the Stream (master reaches enemy temple)
        if moving_piece == "m1" and to_row == 0 and to_col == 2:
            self.winner = "p1"
        elif moving_piece == "m2" and to_row == 4 and to_col == 2:
            self.winner = "p2"
            
        # Rotate Cards
        if player == "p1":
            self.p1_cards.remove(card_name)
            self.p1_cards.append(self.neutral_card)
        else:
            self.p2_cards.remove(card_name)
            self.p2_cards.append(self.neutral_card)
            
        self.neutral_card = card_name
        self.turn = "p2" if player == "p1" else "p1"
        
        return True

    def to_dict(self):
        return {
            "board": self.board,
            "p1_cards": self.p1_cards,
            "p2_cards": self.p2_cards,
            "neutral_card": self.neutral_card,
            "turn": self.turn,
            "winner": self.winner,
            "last_action": self.last_action,
            "is_ai": self.is_ai
        }

    def get_ai_move(self) -> Optional[Tuple[int, int, int, int, str]]:
        if self.winner or self.turn != "p2":
            return None
            
        valid_moves = []
        for r in range(5):
            for c in range(5):
                piece = self.board[r][c]
                if piece.endswith("2"):
                    moves = self.get_valid_moves("p2", r, c)
                    for m in moves:
                        valid_moves.append((r, c, m[0], m[1], m[2]))
        
        if not valid_moves:
            return None
            
        # --- Lógica Minimax Básica (Heurística Nível Médio) ---
        
        # 1. Verifica movimentos que dão a vitória imediata
        for m in valid_moves:
            fr, fc, tr, tc, card = m
            target_piece = self.board[tr][tc]
            moving_piece = self.board[fr][fc]
            # Capturar o mestre inimigo
            if target_piece == "m1":
                return m
            # Levar o próprio mestre ao templo inimigo
            if moving_piece == "m2" and tr == 4 and tc == 2:
                return m
                
        # 2. Verifica se há possibilidade de captura simples
        captures = []
        for m in valid_moves:
            fr, fc, tr, tc, card = m
            if self.board[tr][tc].endswith("1"):
                captures.append(m)
        if captures:
            return random.choice(captures)
            
        # 3. Fallback: faz um movimento aleatório
        # Ponderação para não avançar o Mestre à toa no meio do fogo cruzado
        safe_moves = []
        for m in valid_moves:
            fr, fc, tr, tc, card = m
            if self.board[fr][fc] != "m2":
                safe_moves.append(m)
                
        if safe_moves:
            return random.choice(safe_moves)
            
        return random.choice(valid_moves)
