'use strict'

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const escapeshellarg = require('escapeshellarg');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
const spawnSync = require('child_process').spawnSync;
const exec = require('child-process-promise').exec;
const util = require('util');
const fileType = require('file-type');

class VideoService {
	constructor() {

	}

	formatBlackDetectLine(line) {
		let start = line.substring(0, 25);

		line = line.replace(start, '');

		let blackdetectData = line.split(' ');

		let output = {};

		for (let dataItem of blackdetectData) {
			let explodedData = dataItem.split(':');

			if (!_.isUndefined(explodedData[1])) {
				output[explodedData[0]] = explodedData[1];
			}
		}

		return output;
	}

	generateArgs(args) {
		let formattedArgs = [];

		for (let arg of args) {
			formattedArgs = formattedArgs.concat(arg.split(' '));
		}

		return formattedArgs;
	}

	formatDurationLine(line) {
		let duration = line;
		duration = duration.replace('Duration: ', '');
		duration = duration.split(', ');

		let output = {
			full: duration[0].trim()
		}

		let time = duration[0].split(':');

		output.hour = time[0];
		output.min = time[1];
		output.seconds = time[2];
		output.in_seconds = (parseFloat(output.hour) * 3600) + (parseFloat(output.min) * 60) + parseFloat(output.seconds);

		return output;
	}

	detectBlackFrames(file) {

		let ffmpegArgs = [
			'-i',
			'"' + file + '"',
			'-vf',
			'blackdetect=d=0.1:pix_th=.1',
			'-f',
			'null',
			'-',
			'-y'
		]

		let command = ffmpeg + ' ' + ffmpegArgs.join(' ');

		var outputTemp = '';

		var output = {
			blackdetect: [],
			duration: [],
			ffmpeg_output: ''
		}

		var data = exec(ffmpeg + ' ' + ffmpegArgs.join(' '));

		return data;
	}

	createFrameCapture(file, time) {
		let ffmpegArgs = [
			'-ss',
			time,
			'-i',
			'"' + file + '"',
			'-vframes',
			'1',
			'./thumbnail-' + time + '.jpg',
			'-y'
		]

		var promise = exec(ffmpeg + ' ' + ffmpegArgs.join(' '));

		return promise;
	}

	getFrameCapture(time) {
		try {
			var frameData = fs.readFileSync('./thumbnail-' + time + '.jpg');

			var mimetype = fileType(frameData).mime;

			fs.unlink('./thumbnail-' + time + '.jpg');

			return util.format('data:%s;base64,%s', mimetype, frameData.toString('base64'));
		} catch(err) {

		}
	}

	createVideoSegment(file, start, end, outputFile) {
		let filePath = path.dirname(file);

		let ffmpegArgs = [
			'-ss', start,
			'-i', '"' + file + '"',
			'-t', (end - start),
			'-acodec', 'copy',
			'-vcodec', 'copy',
			'-y',
			'"' + filePath + '/' + outputFile + '"',
		]

		var promise = exec(ffmpeg + ' ' + ffmpegArgs.join(' '));

		return promise;
	}

	parseBlackDetectOutput(data) {
		let stderr = data.stderr.split('\r');

		let output = {
			blackdetect: [],
			duration: [],
			ffmpeg_output: stderr
		}

		// Go through each line
		for (let line of stderr) {
			line = line.trim();

			// If it's a blackdetect line, format it and add it to output
			if (line.indexOf('[blackdetect @') === 0) {
				output.blackdetect.push(this.formatBlackDetectLine(line));
			}

			// If it's a line starting with duration, let's format the duration
			if (line.indexOf('Duration:') === 0) {
				output.duration = this.formatDurationLine(line);
			}
		}

		output.blackdetect.forEach((black) => {
			black.black_start = parseFloat(black.black_start);
			black.black_end = parseFloat(black.black_end);
			black.black_duration = parseFloat(black.black_duration);

			black.black_middle = black.black_start + (black.black_duration / 2);
		});

		return output;
	}

	detectSplits(file) {
		let data = this.detectBlackFrames(file).then((output) => {
			output = this.parseBlackDetectOutput(output);
			this.saveSplits(output, file);

			return output;
		});

		return data;
	}

	saveSplits(data, filename) {
		let json = JSON.stringify(data);

		fs.writeFileSync(filename + '.json', json, 'utf8');
	}

	loadSplits(filename) {
		var data = false
		
		try {
			var fileData = fs.readFileSync(filename + '.json', 'utf8');
			data = JSON.parse(fileData);
		} catch(err) {

		}

		return data;
	}
}
module.exports = VideoService;