import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// PUBLIC_INTERFACE
function App() {
  // States for theme, files, status, video, subtitles, and current subtitle index
  const [theme, setTheme] = useState("light");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processStatus, setProcessStatus] = useState(null); // { id, status, progress, message }
  const [statusHistory, setStatusHistory] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [subtitleFileUrl, setSubtitleFileUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [currentSubtitleIdx, setCurrentSubtitleIdx] = useState(0);

  const videoRef = useRef(null);
  const pollingRef = useRef(null);

  // The backend base URL (assume same domain/proxy; override as needed)
  const API_BASE = process.env.REACT_APP_API_URL || "";

  // Update document theme on change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Listen for video time updates to highlight subtitle
  useEffect(() => {
    if (!videoRef.current || subtitles.length === 0) return;

    // PUBLIC_INTERFACE
    const handleTimeUpdate = () => {
      const currentTime = videoRef.current.currentTime;
      const index = subtitles.findIndex(
        (s, i) =>
          currentTime >= (s.start || 0) &&
          (i === subtitles.length - 1 || currentTime < subtitles[i + 1].start)
      );
      if (index !== -1 && index !== currentSubtitleIdx) {
        setCurrentSubtitleIdx(index);
      }
    };
    videoRef.current.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      videoRef.current &&
        videoRef.current.removeEventListener("timeupdate", handleTimeUpdate);
    };
    // eslint-disable-next-line
  }, [subtitles, videoRef, currentSubtitleIdx]);

  // Poll for processing status if an upload is in progress
  useEffect(() => {
    if (processStatus && processStatus.id && processStatus.status !== "completed" && processStatus.status !== "failed") {
      // PUBLIC_INTERFACE
      const pollStatus = async () => {
        try {
          const resp = await fetch(`${API_BASE}/status?id=${encodeURIComponent(processStatus.id)}`);
          if (resp.ok) {
            const data = await resp.json();
            setProcessStatus(data);
            setStatusHistory((prev) => [
              ...prev.filter((item) => item.id !== data.id),
              data,
            ]);
            // If complete load result
            if (data.status === "completed") {
              fetchSubtitlesAndFiles(data.id);
            }
          }
        } catch (e) {
          // do nothing, keep polling
        }
      };
      pollingRef.current = setInterval(pollStatus, 1500);
      return () => clearInterval(pollingRef.current);
    }
    return undefined;
    // eslint-disable-next-line
  }, [processStatus]);

  // Fetch subtitles and file after processing complete
  async function fetchSubtitlesAndFiles(jobId) {
    try {
      // Get subtitle data (timed for display)
      const resp = await fetch(`${API_BASE}/subtitles?id=${encodeURIComponent(jobId)}`);
      if (resp.ok) {
        const data = await resp.json();
        // Subtitle format example: [{start: float, end: float, text: string}]
        setSubtitles(data.subtitles || []);
      }
      // Get subtitle file (for download, as blob)
      const srtResp = await fetch(`${API_BASE}/files?id=${encodeURIComponent(jobId)}`);
      if (srtResp.ok) {
        const blob = await srtResp.blob();
        setSubtitleFileUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      // ignore for now
    }
  }

  // Handle theme toggle
  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Handle file selection
  // PUBLIC_INTERFACE
  function handleFileChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setVideoUrl(""); // clear previous video
      setSubtitles([]);
      setSubtitleFileUrl("");
      setProcessStatus(null);
      setCurrentSubtitleIdx(0);
    }
  }

  // Handle file upload to backend
  // PUBLIC_INTERFACE
  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setProcessStatus(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const resp = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (resp.ok && data && data.id) {
        setProcessStatus(data);
        setStatusHistory((prev) => [...prev, data]);

        // Video preview for certain file types
        if (/^video\//.test(selectedFile.type)) {
          setVideoUrl(URL.createObjectURL(selectedFile));
        } else {
          setVideoUrl("");
        }
        // Start status polling after small delay
      } else {
        setProcessStatus({ status: "failed", message: data?.message || "Upload failed" });
      }
    } catch (err) {
      setProcessStatus({ status: "failed", message: err?.message || "Upload error" });
    }
    setUploading(false);
  }

  // PUBLIC_INTERFACE
  function handleSubtitleDownload() {
    if (subtitleFileUrl) {
      const a = document.createElement("a");
      a.href = subtitleFileUrl;
      a.download = (selectedFile?.name || "subtitle") + ".srt";
      a.click();
    }
  }

  // Sidebar status list
  // PUBLIC_INTERFACE
  function renderSidebar() {
    return (
      <aside className="sidebar">
        <h2>Status</h2>
        <ul>
          {statusHistory.slice(-5).reverse().map((item) => (
            <li
              key={item.id}
              className={
                item.status === "completed"
                  ? "status-completed"
                  : item.status === "failed"
                  ? "status-failed"
                  : "status-processing"
              }
            >
              <span>{(item.filename || "").split(/\/|\\/).pop()}</span>
              <span className="status-label">
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  // Main upload & video/subtitle area
  // PUBLIC_INTERFACE
  function renderUploadArea() {
    return (
      <div className="main-box">
        <form
          className={`upload-card${selectedFile ? " file-selected" : ""}`}
          onSubmit={handleUpload}
        >
          <label className="upload-label">
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={uploading}
            />
            <span>
              {selectedFile ? (
                <b>{selectedFile.name}</b>
              ) : (
                <>
                  <svg
                    style={{
                      width: 36,
                      height: 36,
                      marginBottom: 6,
                      color: "var(--text-secondary)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
                    />
                  </svg>
                  <span>Click or drag file here</span>
                </>
              )}
            </span>
          </label>
          <button
            className={`btn-upload${uploading ? " loading" : ""}`}
            type="submit"
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>

        {/* Processing info and result */}
        {processStatus && (
          <div className="process-status-msg">
            <strong>
              {processStatus.filename ? (
                <span>File: {processStatus.filename}</span>
              ) : null}
            </strong>
            <br />
            <span>
              {processStatus.status
                ? `Status: ${processStatus.status.charAt(0).toUpperCase() +
                    processStatus.status.slice(1)}`
                : ""}
            </span>
            {processStatus.message && (
              <>
                <br />
                <span className="process-msg">{processStatus.message}</span>
              </>
            )}
            {processStatus.status === "completed" && (
              <>
                <br />
                {subtitleFileUrl && (
                  <button className="btn-accent" onClick={handleSubtitleDownload}>
                    Download Subtitle
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Video preview */}
        {(videoUrl || subtitles.length > 0) && (
          <div className="video-player-box">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                preload="auto"
                style={{
                  maxWidth: "100%",
                  background: "#000",
                  borderRadius: "8px",
                }}
              />
            ) : (
              <div className="player-placeholder">No Preview</div>
            )}
            {subtitles.length > 0 && (
              <div className="subtitle-box">
                {renderSubtitleDisplay()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Subtitle display (below video)
  function renderSubtitleDisplay() {
    if (!subtitles.length) return null;
    return (
      <div className="subtitle-list">
        {subtitles.map((line, i) => (
          <div
            key={i}
            className={
              i === currentSubtitleIdx
                ? "subtitle-line active"
                : "subtitle-line"
            }
          >
            {line.text}
            <span className="subtitle-time">
              [{formatTime(line.start)} - {formatTime(line.end)}]
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Format time in mm:ss
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  // Top Navigation Bar
  function renderNavbar() {
    return (
      <nav className="navbar">
        <span className="navbar-title">Subtitle Sync</span>
        <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
      </nav>
    );
  }

  // Layout rendering
  return (
    <div className="App">
      {renderNavbar()}
      <div className="content-container">
        {renderSidebar()}
        <main className="content-main">{renderUploadArea()}</main>
      </div>
      <footer className="footer">
        <span>
          Powered by WhisperX &middot;{" "}
          <a
            className="footer-link"
            href="https://github.com/m-bain/whisperX"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn More
          </a>
        </span>
      </footer>
    </div>
  );
}

export default App;
