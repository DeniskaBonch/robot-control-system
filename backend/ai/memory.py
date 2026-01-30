from collections import deque

class OperatorMemory:
    def __init__(self, max_len=20):
        self.commands = deque(maxlen=max_len)

    def add(self, command: dict):
        self.commands.append(command)

    def recent(self):
        return list(self.commands)
