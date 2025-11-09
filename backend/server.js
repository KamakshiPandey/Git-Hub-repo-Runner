// import express from "express";
// import cors from "cors";
// import { promises as fs } from "fs";
// import path from "path";
// import simpleGit from "simple-git";

// const app = express();
// const PORT = 5000;

// app.use(cors());
// app.use(express.json());

// const reposDir = path.join(process.cwd(), "repos");
// await fs.mkdir(reposDir, { recursive: true });

// // Clone repo endpoint
// app.post("/clone", async (req, res) => {
//   const { repoUrl } = req.body;
//   if (!repoUrl) return res.status(400).json({ error: "Repo URL required" });

//   try {
//     const repoName = repoUrl.split("/").pop().replace(".git", "");
//     const repoPath = path.join(reposDir, repoName);

//     const git = simpleGit();
//     if (!(await exists(repoPath))) {
//       await git.clone(repoUrl, repoPath);
//     }

//     const files = await listFiles(repoPath);
//     res.json({ repoName, files });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Fetch file content
// app.get("/file", async (req, res) => {
//   const { repo, filepath } = req.query;
//   if (!repo || !filepath) return res.status(400).json({ error: "Missing params" });

//   try {
//     const fullPath = path.join(reposDir, repo, filepath);
//     const content = await fs.readFile(fullPath, "utf-8");
//     res.json({ content });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// async function exists(p) {
//   try {
//     await fs.access(p);
//     return true;
//   } catch {
//     return false;
//   }
// }

// async function listFiles(dir, base = "") {
//   const entries = await fs.readdir(dir, { withFileTypes: true });
//   const result = [];
//   for (let e of entries) {
//     if (e.isDirectory()) {
//       result.push(...await listFiles(path.join(dir, e.name), path.join(base, e.name)));
//     } else {
//       result.push(path.join(base, e.name));
//     }
//   }
//   return result;
// }

// app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
// backend/server.js
const express = require("express");
const cors = require("cors");
const { promises: fs } = require("fs");
const path = require("path");
const simpleGit = require("simple-git");
const { spawn } = require("child_process");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const reposDir = path.join(process.cwd(), "repos");

// ensure repos dir
fs.mkdir(reposDir, { recursive: true }).catch(console.error);

// In-memory map for container sessions: sessionId -> { containerName, repoPath }
const sessions = {};

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, base = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  for (let e of entries) {
    if (e.isDirectory()) {
      result.push(...(await listFiles(path.join(dir, e.name), path.join(base, e.name))));
    } else {
      result.push(path.join(base, e.name));
    }
  }
  return result;
}

// Clone endpoint (same as before) - returns repoName and files
app.post("/clone", async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: "Repo URL required" });

    const repoName = repoUrl.split("/").pop().replace(".git", "");
    const repoPath = path.join(reposDir, repoName);

    const git = simpleGit();
    if (!(await exists(repoPath))) {
      await git.clone(repoUrl, repoPath);
    }

    const files = await listFiles(repoPath);
    res.json({ repoName, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch file content
app.get("/file", async (req, res) => {
  const { repo, filepath } = req.query;
  if (!repo || !filepath) return res.status(400).json({ error: "Missing params" });

  try {
    const fullPath = path.join(reposDir, repo, filepath);
    const content = await fs.readFile(fullPath, "utf-8");
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save edited file (Monaco -> backend)
app.post("/save-file", async (req, res) => {
  const { repo, filepath, content } = req.body;
  if (!repo || !filepath) return res.status(400).json({ error: "Missing params" });

  try {
    const fullPath = path.join(reposDir, repo, filepath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start container for a repo and return a session id
// Body: { repo }  -> mounts repo folder
app.post("/start-session", async (req, res) => {
  try {
    const { repo } = req.body;
    if (!repo) return res.status(400).json({ error: "Missing repo" });

    const repoPath = path.join(reposDir, repo);
    if (!(await exists(repoPath))) return res.status(404).json({ error: "Repo not found. Clone first." });

    const sessionId = uuidv4();
    const containerName = `cloudrv_${sessionId.slice(0, 8)}`;

    // Docker run: start container in background with a sleeping command so we can exec later.
    // WARNING: this mounts your host repo into the container -- in prod sandbox and limit resources.
    // Using node image as an example; you can switch to other base images depending on project.
    const dockerArgs = [
      "run",
      "--rm",
      "-d",
      "--name",
      containerName,
      "-v",
      `${repoPath}:/workspace`, // mount repo into /workspace
      "-w",
      "/workspace",
      "node:18",
      "tail",
      "-f",
      "/dev/null"
    ];

    const run = spawn("docker", dockerArgs);

    run.on("error", (err) => {
      console.error("docker run error:", err);
    });

    let dockerStdout = "";
    run.stdout.on("data", (d) => (dockerStdout += d.toString()));
    run.stderr.on("data", (d) => console.error("docker run stderr:", d.toString()));

    run.on("close", (code) => {
      // container started; docker run prints container id normally (but we used --rm -d so it's silent)
      // store session info regardless
      sessions[sessionId] = { containerName, repoPath };
      res.json({ sessionId, containerName });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Exec a command inside an existing container; this streams via socket.io
// Body: { sessionId, command }
// The client will open a socket.io connection and listen to `output:<sessionId>` events.
app.post("/exec", async (req, res) => {
  try {
    const { sessionId, command } = req.body;
    if (!sessionId || !command) return res.status(400).json({ error: "Missing params" });

    const s = sessions[sessionId];
    if (!s) return res.status(404).json({ error: "Session not found" });

    // Use docker exec to run the command
    // Use /bin/sh -lc to allow pipes and complex commands
    const execArgs = ["exec", "-i", s.containerName, "/bin/sh", "-lc", `cd /workspace && ${command}`];

    const child = spawn("docker", execArgs);

    const socketEvent = `output:${sessionId}`;

    child.stdout.on("data", (d) => {
      io.emit(socketEvent, { type: "stdout", text: d.toString() });
    });
    child.stderr.on("data", (d) => {
      io.emit(socketEvent, { type: "stderr", text: d.toString() });
    });

    child.on("close", (code) => {
      io.emit(socketEvent, { type: "exit", code });
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Stop and remove container for a session
app.post("/stop-session", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
    const s = sessions[sessionId];
    if (!s) return res.status(404).json({ error: "Session not found" });

    const stop = spawn("docker", ["rm", "-f", s.containerName]);
    stop.on("close", () => {
      delete sessions[sessionId];
      res.json({ ok: true });
    });
    stop.on("error", (e) => {
      console.error(e);
      res.status(500).json({ error: e.message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

// socket.io connection handler
io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
  socket.on("disconnect", () => console.log("socket disconnected", socket.id));
});
