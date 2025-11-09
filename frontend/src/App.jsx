// import React, { useState } from "react";
// import axios from "axios";
// import FileViewer from "./FileViewer";

// const App = () => {
//   const [repoUrl, setRepoUrl] = useState("");
//   const [files, setFiles] = useState([]);
//   const [repoName, setRepoName] = useState("");
//   const [selectedFile, setSelectedFile] = useState(null);

//   const handleClone = async () => {
//     try {
//       const res = await axios.post("http://localhost:5000/clone", { repoUrl });
//       setRepoName(res.data.repoName);
//       setFiles(res.data.files);
//     } catch (err) {
//       alert("Error: " + err.message);
//     }
//   };

//   return (
//     <div className="p-6">
//       <h1>🌐 Cloud Repo Viewer</h1>
//       <input
//         type="text"
//         value={repoUrl}
//         onChange={(e) => setRepoUrl(e.target.value)}
//         placeholder="Enter GitHub repo URL"
//         style={{ width: "400px" }}
//       />
//       <button onClick={handleClone}>Clone</button>

//       {files.length > 0 && (
//         <div style={{ display: "flex", marginTop: "20px" }}>
//           <div style={{ width: "200px", borderRight: "1px solid gray" }}>
//             <h3>Files</h3>
//             <ul>
//               {files.map((f) => (
//                 <li key={f} onClick={() => setSelectedFile(f)} style={{ cursor: "pointer" }}>
//                   {f}
//                 </li>
//               ))}
//             </ul>
//           </div>

//           <div style={{ flex: 1, paddingLeft: "20px" }}>
//             {selectedFile ? (
//               <FileViewer repo={repoName} filepath={selectedFile} />
//             ) : (
//               <p>Select a file to view</p>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default App;
// frontend/src/App.jsx
import React, { useState } from "react";
import axios from "axios";
import FileViewer from "./FileViewer";
import TerminalPanel from "./Terminal";

const API = "http://localhost:5000";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [repoName, setRepoName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [command, setCommand] = useState("");

  const handleClone = async () => {
    try {
      const res = await axios.post(`${API}/clone`, { repoUrl });
      setRepoName(res.data.repoName);
      setFiles(res.data.files);
    } catch (err) {
      alert("Error cloning: " + err?.response?.data?.error ?? err.message);
    }
  };

  const handleStartSession = async () => {
    if (!repoName) return alert("Clone a repo first");
    const res = await axios.post(`${API}/start-session`, { repo: repoName });
    setSessionId(res.data.sessionId);
  };

  const handleExec = async () => {
    if (!sessionId) return alert("Start a session first");
    if (!command) return;
    await axios.post(`${API}/exec`, { sessionId, command });
    setCommand("");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Cloud Repo Viewer + Runner</h1>

      <div style={{ marginBottom: 12 }}>
        <input style={{ width: 500 }} value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="Enter GitHub repo URL" />
        <button onClick={handleClone} style={{ marginLeft: 8 }}>Clone</button>
        <button onClick={handleStartSession} style={{ marginLeft: 8 }}>Start Session (Docker)</button>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 260, borderRight: "1px solid #ddd", paddingRight: 12 }}>
          <h3>Files</h3>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {files.map((f) => (
              <li key={f} style={{ cursor: "pointer" }} onClick={() => setSelectedFile(f)}>{f}</li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          {selectedFile ? <FileViewer repo={repoName} filepath={selectedFile} /> : <p>Select a file</p>}
          <div style={{ marginTop: 12 }}>
            <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Command to run in container (e.g. node index.js)" style={{ width: "70%" }} />
            <button onClick={handleExec} style={{ marginLeft: 8 }}>Run</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <h3>Terminal Output</h3>
            <TerminalPanel sessionId={sessionId} />
          </div>
        </div>
      </div>
    </div>
  );
}
