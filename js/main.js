// Gilián Zoltán <gilian@caesar.elte.hu>, 2014
// Simplified BSD License

var message = null;
var canvas = null;
var ctx = null;

var audio_context = null;
var processor = null
var source = null;

var gui = null;

var controller = {
	ref_level: 1e-4,
	db_min: -70,
	db_range: 70,
	freq_min_cents: 4*1200, // relative to C0
	freq_range_cents: 3*1200, // 3 octaves
	block_size: 1024,
	blocks_per_fft: 8,
};

var sample_buffer = null;
var fft = null;

var log2 = Math.log(2);
var log10 = Math.log(10);

navigator.getUserMedia = navigator.getUserMedia ||
	navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

window.requestAnimationFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.msRequestAnimationFrame;

var AudioContext = AudioContext || webkitAudioContext || mozAudioContext;

function NumSubStr(num) {
	var res = '';
	for(; num > 0; num = Math.floor(num / 10)) {
		res = String.fromCharCode(8320 + (num % 10)) + res;
	}
	return res;
}

function Render() {
	window.requestAnimationFrame(Render);
	if (!sample_buffer.IsFilled()) {
		return
	}

	var num_samples = sample_buffer.size;
	var samples = new Float32Array(2 * num_samples)

	for (var i = 0; i < num_samples; ++i) {
		samples[2*i+0] = sample_buffer.Get(i);  // real
		samples[2*i+1] = 0;                     // imag
	}

	// apply window

	var fft_size = controller.block_size * controller.blocks_per_fft;
	for (var i = 0; i < num_samples; ++i) {
		x = 2 * Math.PI * i / (fft_size - 1);
		// Hamming window
		w = 0.54 - 0.46 * Math.cos(x);

		// Nuttall window
		//w = 0.355768 - 0.487396 * Math.cos(x) + 0.144232 * Math.cos(2*x) + 0.012604 * Math.cos(3*x);
		
		samples[2*i+0] *= w;  // real
		samples[2*i+1] *= w;  // imag
	}

	// FFT

	fft.Forward(samples);

	// render STFT curve

	var freq_res = audio_context.sampleRate / num_samples;
	var freq_nyquist = audio_context.sampleRate / 2;

	var c0_freq = 16.35;
	var c0_cents = 1200 * Math.log(c0_freq) / log2;
	var freq_cent = Math.pow(2, 1/1200);
	var freq_min = c0_freq * Math.pow(freq_cent, controller.freq_min_cents);
	var freq_max = c0_freq * Math.pow(freq_cent, controller.freq_min_cents + controller.freq_range_cents);

	var text_width = 60;
	var text_height = 15;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	ctx.beginPath();
	ctx.lineWidth = '2';

	var freq_step = Math.pow(freq_cent, 10);
	for (var freq = freq_min, i = 0; freq < Math.min(freq_max, freq_nyquist); freq *= freq_step, ++i) {
		var bin = Math.floor(freq / freq_res)
		re = samples[bin << 1];
		im = samples[bin << 1 | 1];
		fftMagSq = Math.pow(re / num_samples, 2) + Math.pow(im / num_samples, 2);
		x = (i * 10 / controller.freq_range_cents) * (canvas.width - 2 * text_width) + text_width;
		db = 20 * Math.log(fftMagSq / controller.ref_level) / log10;
		if (db < controller.db_min) db = controller.db_min;
		y = (1 - (db - controller.db_min) / controller.db_range) * (canvas.height - 2 * text_height);

		if (freq == freq_min) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}

	ctx.stroke();

	// render x axis labels

	ctx.font = text_height.toString() + "px Arial";
	ctx.textBaseline = 'top';
	ctx.textAlign = 'center'
	var i = 1;
	for (var cents_rel = 0; cents_rel < controller.freq_range_cents + 10; cents_rel += 100) {
		var cents = controller.freq_min_cents + cents_rel;
		var octave = Math.round(cents / 1200);
		var note = Math.round(cents % 1200 / 100) % 12;
		var note_names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
		var x = cents_rel / controller.freq_range_cents * (canvas.width - 2 * text_width) + text_width;
		var y = canvas.height - text_height;
		var label = note_names[note] + NumSubStr(octave);
		ctx.fillText(label, x, y);
	}

	// render y axis labels

	ctx.textBaseline = 'middle';
	ctx.textAlign = 'right'
	var base_y = canvas.height - 2*text_height;
	var db_step = Math.ceil(controller.db_range/20);
	var db_max = controller.db_min + controller.db_range;
	var x = text_width - 15;
	for (var db=controller.db_min; db <= db_max; db += db_step) {
		db_int = Math.round(db);
		var y = base_y * (1 - (db_int-controller.db_min)/controller.db_range);
		ctx.fillText(db_int.toString() + ' dB', x, y);
	}
}

function UpdateController() {
	if (processor) {
		source.disconnect();
		processor.disconnect();
	}

	controller.block_size = parseInt(controller.block_size);
	controller.blocks_per_fft = parseInt(controller.blocks_per_fft);

	sample_buffer = new Float32CyclicBuffer(controller.block_size, controller.blocks_per_fft);
	fft = new FFTAlgorithm(controller.block_size * controller.blocks_per_fft);

	processor = audio_context.createScriptProcessor(controller.block_size, 1, 1);
	processor.onaudioprocess = function(evt) {
		sample_buffer.Push(evt.inputBuffer.getChannelData(0));
	};
	source.connect(processor);
	// ScriptProcessorNode needs a connected output to work
	processor.connect(audio_context.destination);
}

function StartProcessing(stream)
{
	message.innerHTML = '';

	var gui = new dat.GUI();
	gui.add(controller, 'ref_level', {'1e-0': 1e-0, '1e-1': 1e-1, '1e-2': 1e-2, '1e-3': 1e-3, '1e-4': 1e-4, '1e-5': 1e-5, '1e-6': 1e-6, '1e-7': 1e-7, '1e-8': 1e-8});
	gui.add(controller, 'db_min', -100, 30);
	gui.add(controller, 'db_range', 1, 100);
	gui.add(controller, 'freq_min_cents', 0, 10000).step(1);
	gui.add(controller, 'freq_range_cents', 0, 10000).step(1);
	gui.add(controller, 'block_size', [128, 256, 512, 1024, 2048, 4096]).onChange(function(value) {
		UpdateController();
	});
	gui.add(controller, 'blocks_per_fft', [1, 2, 4, 8, 16, 32, 64]).onChange(function(value) {
		UpdateController();
	});

	source = audio_context.createMediaStreamSource(stream);
	UpdateController();
	Render();
}

function Init() {
	message = document.querySelector('#message');
	canvas = document.querySelector('#canvas');
	canvas.width = '1000';
	canvas.height = '600';
	ctx = canvas.getContext('2d');

	try {
		audio_context = new AudioContext();
	} catch(e) {
		console.log('The Web Audio API is apparently not supported in this browser. ', e);
		message.innerHTML = 'The Web Audio API is apparently not supported in this browser.'
		return;
	}

	message.innerHTML = 'To continue, please allow the application to access the audio capture device.'
	navigator.getUserMedia({audio:true}, StartProcessing, function(e) {
		console.log('navigator.getUserMedia error: ', e);
		message.innerHTML = 'navigator.getUserMedia error: ' + e.name;
	});
}
