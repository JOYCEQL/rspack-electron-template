import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, importScript, toBlobURL } from '@ffmpeg/util';
import React, { useState, useRef, useEffect } from 'react';
function ScreenRecorder() {
	const [recording, setRecording] = useState(false);
	const mediaRecorderRef = useRef(null);
	const dataUrl = useRef(null);
	const workerRef = useRef(null);
	const resultUrl = useRef(null);
  const recordedChunks = useRef([]);
  const [recordEnd,setEecordEnd]=useState(false)
  


	useEffect(() => {
		// 创建 Web Worker
    workerRef.current = new Worker(new URL('./ffmpegWorker.js', import.meta.url))
		workerRef.current.onmessage = (event) => {
			const { status, blob } = event.data;
			if (status === 'loaded') {
			} else if (status === 'done') {
        setEecordEnd(true)
				resultUrl.current = URL.createObjectURL(blob);
			}
		};

		// 加载 FFmpeg
		workerRef.current.postMessage({ command: 'load' });
    setEecordEnd(false)

		return () => {
			workerRef.current.terminate(); // 清理 Worker
		};
	}, []);

	const startRecording = async () => {
		const sources = await window.electronAPI.getDesktopSources();

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					mandatory: {
						chromeMediaSource: 'desktop',
						chromeMediaSourceId: sources[0].id,
					},
				},
			});

			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			mediaRecorderRef.current.ondataavailable = async (event) => {
				if (event.data.size > 0) {
          recordedChunks.current = [...recordedChunks.current, event.data]
				}
			};
			mediaRecorder.start();
			window.electronAPI.startOverlay();
			setRecording(true);
		} catch (error) {
			console.error('Error accessing media devices.', error);
		}
	};

	const stopRecording = async () => {

		mediaRecorderRef.current.stop();
		window.electronAPI.stopOverlay();
		setRecording(false);
    
    mediaRecorderRef.current.onstop=async (event)=>{
      const blob = new Blob(recordedChunks.current, {
        type: 'video/webm',
      });
      workerRef.current && workerRef.current.postMessage({
        command: 'convert',
        data: { inputBlob: URL.createObjectURL(blob), outputFileName: 'output.mp4' },
      });
    }
	};

	const saveRecording = async () => {
		const a = document.createElement('a');
		document.body.appendChild(a);
		a.style = 'display: none';
		a.href = resultUrl.current;
		a.download = 'screen-recording.mp4';
		a.click();
		window.URL.revokeObjectURL(resultUrl.current);
		recordedChunks.current=[];
	};

	return (
		<div>
			{!recording && <button onClick={startRecording}>Start Recording</button>}
			{recording && <button onClick={stopRecording}>Stop Recording</button>}
			{recordEnd &&<button onClick={saveRecording}>Save Recording</button>}
		</div>
	);
}

export default ScreenRecorder;
