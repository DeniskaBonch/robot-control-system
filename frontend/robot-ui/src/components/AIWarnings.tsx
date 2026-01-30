import React from "react";

interface AIWarningsProps {
  messages: string[];
}

export const AIWarnings: React.FC<AIWarningsProps> = ({ messages }) => {
  return (
    <div style={{ color: "red", position: "absolute", top: 10, left: 10 }}>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
    </div>
  );
};
