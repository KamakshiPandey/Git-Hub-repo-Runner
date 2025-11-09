// frontend/src/Terminal.jsx
import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import io from "socket.io-client";
import "xterm/css/xterm.css";

const BACKEND = "http://localhost:5000"; // adjust if backend is remote

export default function TerminalPanel({ sessionId }) {
  const ref = useRef(null);
  const termRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const term = new Terminal({ cols: 80, rows: 24 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(ref.current);
    fitAddon.fit();
    termRef.current = term;

    const socket = io(BACKEND, { transports: ["websocket"] });
    socketRef.current = socket;

    const event = `output:${sessionId}`;
    socket.on(event, (data) => {
      if (data.type === "stdout" || data.type === "stderr") {
        term.write(data.text);
      } else if (data.type === "exit") {
        term.write(`\r\n\nProcess exited with code ${data.code}\r\n`);
      }
    });

    // allow user to type and send commands with Enter (local echo)
    term.onKey(({ key, domEvent }) => {
      // we only capture Enter to send command; user input is simple here.
      if (domEvent.key === "Enter") {
        // simplistic: get the last line typed
        // For a more advanced terminal, implement a proper pty backend.
        const buffer = term.buffer.active;
        const lastLine = buffer.getLine(buffer.length - 1);
        // Not implementing full parsing: user should use the input box to send commands.
      }
    });

    return () => {
      socket.disconnect();
      term.dispose();
    };
  }, [sessionId]);

  return <div style={{ width: "100%", height: "300px", background: "#000" }} ref={ref}></div>;
}
