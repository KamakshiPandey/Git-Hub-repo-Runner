// import React, { useEffect, useState } from "react";
// import axios from "axios";
// import Editor from "@monaco-editor/react";

// const FileViewer = ({ repo, filepath }) => {
//   const [content, setContent] = useState("");

//   useEffect(() => {
//     const fetchFile = async () => {
//       const res = await axios.get("http://localhost:5000/file", {
//         params: { repo, filepath }
//       });
//       setContent(res.data.content);
//     };
//     fetchFile();
//   }, [repo, filepath]);

//   return (
//     <div>
//       <h2>{filepath}</h2>
//       <Editor
//         height="80vh"
//         defaultLanguage="javascript"
//         value={content}
//         onChange={(value) => setContent(value)}
//       />
//     </div>
//   );
// };

// export default FileViewer;
// frontend/src/FileViewer.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";

const API = "http://localhost:5000";

const FileViewer = ({ repo, filepath }) => {
  const [content, setContent] = useState("");

  useEffect(() => {
    const fetchFile = async () => {
      const res = await axios.get(`${API}/file`, { params: { repo, filepath } });
      setContent(res.data.content);
    };
    fetchFile();
  }, [repo, filepath]);

  const saveFile = async () => {
    await axios.post(`${API}/save-file`, { repo, filepath, content });
    alert("Saved to backend");
  };

  return (
    <div>
      <h2>{filepath}</h2>
      <div style={{ marginBottom: 8 }}>
        <button onClick={saveFile}>Save to backend</button>
      </div>
      <Editor height="60vh" defaultLanguage="javascript" value={content} onChange={(v) => setContent(v)} />
    </div>
  );
};

export default FileViewer;

