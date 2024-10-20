import { FFmpeg } from '@ffmpeg/ffmpeg';
// ffmpegWorker.js
import { fetchFile } from '@ffmpeg/util';
const ffmpegRef = new FFmpeg();

self.onmessage = async (event) => {
	const { command, data } = event.data;

	if (command === 'convert') {
		await ffmpegRef.load();
		const { inputBlob, outputFileName } = data;

		// 将 Blob 转换为 FFmpeg 文件
		await ffmpegRef.writeFile('input.webm', await fetchFile(inputBlob));
		// 转码
		await ffmpegRef.exec(['-i', 'input.webm', 'output.mp4']);

		// 读取输出文件
		const fileData = await ffmpegRef.readFile('output.mp4');
		const outputData = new Uint8Array(fileData);
		// 转换为 Blob
		const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
		// 发送结果回主线程
		self.postMessage({ status: 'done', blob });
	}
};
