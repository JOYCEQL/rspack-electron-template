import { Pause, Play, Save } from "lucide-react";
import React, { useState, useRef, useEffect, useCallback } from "react";
import "./screen.css";

function ScreenRecorder() {
  const [recording, setRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const animationFrameRef = useRef(null);
  const playbackRef = useRef({ isPlaying: false }).current;

  const FPS = 60;
  const frameInterval = 1000 / FPS;

  const startRecording = async () => {
    const sources = await window.electronAPI.getDesktopSources();
    try {
      const displayWidth = window.screen.width * window.devicePixelRatio;
      const displayHeight = window.screen.height * window.devicePixelRatio;
  
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sources[0].id,
          }
        }  
      });

      streamRef.current = stream;
      const options = {
        videoBitsPerSecond: 8000000, 
        audioBitsPerSecond: 128000,
        mimeType: 'video/webm;codecs=vp8', 
      };
  
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      window.electronAPI.startOverlay();
      setRecording(true);
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && streamRef.current) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach((track) => track.stop());
      window.electronAPI.stopOverlay();
      setRecording(false);

      mediaRecorderRef.current.onstop = () => {
        processRecordedVideo()
          .then(() => {
            setIsEditing(true);
          })
          .catch((error) => {
            console.error("处理视频时出错:", error);
          });
      };
    }
  };

  const saveRecording = async () => {
    if (frames.length === 0) {
      console.error("No frames to save");
      return;
    }

    setIsSaving(true);

    try {
 
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = `screen-recording-${new Date().toISOString()}.webm`;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    setIsSaving(false);
    } catch (error) {
      console.error('保存视频时出错:', error);
      setIsSaving(false);
    }
  };

  const processRecordedVideo = async () => {
    const videoBlob = new Blob(recordedChunksRef.current, {
      type: "video/webm"
    });
    const videoURL = URL.createObjectURL(videoBlob);
    const video = document.createElement("video");

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.warn("视频加载超时，尝试直接处理");
        handleVideoFrames(video);
        resolve();
      }, 5000);

      const handleLoad = () => {
        clearTimeout(timeoutId);
        console.log("视频数据已加载");
        handleVideoFrames(video);
        resolve();
      };

      video.addEventListener("loadeddata", handleLoad);
      video.addEventListener("error", (e) => {
        clearTimeout(timeoutId);
        console.error("视频加载错误:", e);
        reject(e);
      });

      video.src = videoURL;
      video.currentTime = 0;
      document.body.appendChild(video);
      video.style.display = "none";
    });
  };

  const handleVideoFrames = (video) => {
    if (video.duration === Number.POSITIVE_INFINITY) {
      video.currentTime = 1e101;
      setTimeout(() => {
        video.currentTime = 0;
        const totalFrames = Math.floor(video.duration * FPS);
        setDuration(video.duration);
        const interval = 1000 / FPS;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { alpha: false });

        const displayWidth = canvas.width;
        const displayHeight = canvas.height;
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        let currentTime = 0;
        const frameArray = [];
        let processedFrames = 0;

        const processNextFrame = () => {
          if (processedFrames >= totalFrames) {
            setFrames(frameArray);
            setCurrentFrame(0);
            if (frameArray.length > 0) {
              const img = new Image();
              img.src = frameArray[0].image;
              img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              };
            }
            document.body.removeChild(video);
            return;
          }

          video.currentTime = currentTime;
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL("image/jpeg", 1);
            frameArray.push({
              image: frameData,
              timestamp: currentTime
            });

            processedFrames++;
            currentTime += interval / 1000;
            processNextFrame();
          };
        };

        processNextFrame();
      }, 2000);
    }
  };

  const playFrame = useCallback(() => {
    if (!playbackRef.isPlaying || !frames.length) return;

    setCurrentFrame((prev) => {
      const nextFrame = prev + 1;
      if (nextFrame >= frames.length) {
        playbackRef.isPlaying = false;
        setIsPlaying(false);
        return 0;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d", { alpha: false });
        const displayWidth = canvas.width;
        const displayHeight = canvas.height;

        const img = new Image();
        img.src = frames[nextFrame].image;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
        };
      }
      return nextFrame;
    });

    animationFrameRef.current = setTimeout(() => {
      requestAnimationFrame(playFrame);
    }, frameInterval);
  }, [frames]);

  const togglePlayback = useCallback(() => {
    if (playbackRef.isPlaying) {
      playbackRef.isPlaying = false;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsPlaying(false);
    } else {
      playbackRef.isPlaying = true;
      setIsPlaying(true);
      playFrame();
    }
  }, [playFrame]);

  const handleTimelineClick = (e) => {
    if (playbackRef.isPlaying) {
      playbackRef.isPlaying = false;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsPlaying(false);
    }

    const timeline = e.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const frameIndex = Math.floor(percentage * (frames.length - 1));
    setCurrentFrame(frameIndex);

    if (frames[frameIndex]) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = frames[frameIndex].image;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }
  };

  const renderTimelineMarks = () => {
    if (!duration) return null;

    const marks = [];
    const markCount = Math.floor(duration);

    for (let i = 0; i <= markCount; i++) {
      const isMinor = i % 5 !== 0;
      marks.push(
        <div
          key={i}
          className={`timeline-ruler-mark ${isMinor ? "minor" : "major"}`}
          style={{ left: `${(i / markCount) * 100}%` }}
        >
          {!isMinor && (
            <span className="timeline-ruler-text">{formatTime(i)}</span>
          )}
        </div>
      );
    }

    return <div className="timeline-ruler">{marks}</div>;
  };

  useEffect(() => {
    return () => {
      playbackRef.isPlaying = false;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getCurrentTime = useCallback(() => {
    if (!frames.length || currentFrame < 0) return 0;
    const frameTimeInSeconds = (1 / FPS) * currentFrame;
    return Math.min(frameTimeInSeconds, duration);
  }, [frames.length, currentFrame, duration, FPS]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="screen-recorder">
      {isEditing ? (
        <div className="editor-container">
          <div className="preview-container">
            <canvas ref={canvasRef} height={'auto'} className="video-canvas" />

            <div className="controls">
              <button
                onClick={togglePlayback}
                className="play-button"
                title={isPlaying ? "Pause" : "Play"}
                disabled={isSaving}
              >
                {isPlaying ? (
                  <Pause className="icon" />
                ) : (
                  <Play className="icon" />
                )}
              </button>
              <button
                onClick={saveRecording}
                className="save-button"
                disabled={isSaving}
                title="Save Recording"
              >
                <Save className="icon" />
                {isSaving ? "Saving..." : "Save"}
              </button>
              <span className="time-display">
                {formatTime(getCurrentTime())} / {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="timeline-container">
            {renderTimelineMarks()}
            <div className="timeline" onClick={handleTimelineClick}>
              <div className="frames-container">
                {frames.map((frame, index) => (
                  <div
                    key={index}
                    className={`frame-preview ${currentFrame === index ? "active" : ""}`}
                    style={{
                      maxWidth: `${100 / Math.min(20, frames.length)}%`
                    }}
                  >
                    <img
                      src={frame.image}
                      alt={`frame-${index}`}
                      className="frame-image"
                    />
                  </div>
                ))}
              </div>

              <div
                className="playhead"
                style={{
                  left: `${(currentFrame / Math.max(frames.length - 1, 1)) * 100}%`
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="recording-controls">
          {!recording && (
            <button onClick={startRecording} className="record-button">
              Start Recording
            </button>
          )}
          {recording && (
            <button onClick={stopRecording} className="stop-button">
              Stop Recording
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ScreenRecorder;