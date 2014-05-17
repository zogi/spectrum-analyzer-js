// Gilián Zoltán <gilian@caesar.elte.hu>, 2014
// Simplified BSD License

var message = null;
var canvas = null;
var ctx = null;

var audio_context = null;
var processor = null
var source = null;

var block_size = 512;
var num_blocks = 32;
var sample_buffer = new Float32CyclicBuffer(block_size, num_blocks);

var fft_size = num_blocks * block_size;
var fft = new FFTAlgorithm(fft_size);

var log2 = Math.log(2);
var log10 = Math.log(10);

var min_freq = 261.63; // C4
var max_freq = 2093.0; // C7
var dB_cutoff = -60;

// compatibility

navigator.getUserMedia = navigator.getUserMedia ||
	navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

window.requestAnimationFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.msRequestAnimationFrame;

var AudioContext = AudioContext || webkitAudioContext || mozAudioContext;

// rendering

var first = true;

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

	var freq_res = audio_context.sampleRate / num_samples;
	var freq_cent = Math.pow(2, 1/1200);
	var freq_mul_cents = 10;
	var freq_mul = Math.pow(freq_cent, freq_mul_cents);
	var freq_min_cents = 1200 * Math.log(min_freq) / log2;
	var freq_max_cents = 1200 * Math.log(max_freq) / log2;
	var freq_range_cents = freq_max_cents - freq_min_cents;

	var text_width = 30;
	var text_height = 15;

	// render STFT curve

	if (first) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	} else {
		ctx.clearRect(text_width - 2, text_height - 2, canvas.width - 2 * text_width + 4, canvas.height - 2 * text_height + 4);
	}
	ctx.beginPath();
	ctx.lineWidth = '2';

	for (var freq = min_freq, i = 0; freq <= max_freq; freq *= freq_mul, ++i) {
		var bin = Math.floor(freq / freq_res)
		re = samples[bin << 1];
		im = samples[bin << 1 | 1];
		fftMagSq = Math.pow(re / num_samples, 2) + Math.pow(im / num_samples, 2);
		x = (i * freq_mul_cents / freq_range_cents) * (canvas.width - 2 * text_width) + text_width;
		dB = 20 * Math.log(fftMagSq / 1e-5) / log10;
		if (dB < dB_cutoff) dB = dB_cutoff;
		y = ((dB / dB_cutoff - 1) * 0.4 + 1) * (canvas.height - text_height * 1.5);

		if (freq == min_freq) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}

	ctx.stroke();

	if (first) {
		// render text
		var c0_cents = 1200 * Math.log(16.35) / log2;
		ctx.font = text_height.toString() + "px Arial";
		ctx.textBaseline = 'top';
		ctx.textAlign = 'center'
		var i = 1;
		for (var cents = freq_min_cents; cents < freq_max_cents + 10; cents += 100) {
			var octave = Math.round((cents - c0_cents) / 1200);
			var note = Math.round((cents - c0_cents) % 1200 / 100) % 12;
			var note_names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
			var x = (cents - freq_min_cents) / freq_range_cents * (canvas.width - 2 * text_width) + text_width;
			var y = canvas.height - text_height;
			var label = note_names[note] + String.fromCharCode(8320 + octave);
			ctx.fillText(label, x, y);
		}
	}

	first = false;
}

// initialization

function StartProcessing(stream)
{
	message.innerHTML = '';
	source = audio_context.createMediaStreamSource(stream);
	processor = audio_context.createScriptProcessor(block_size, 1, 1);
	processor.onaudioprocess = function(evt) {
		sample_buffer.Push(evt.inputBuffer.getChannelData(0));
	};
	source.connect(processor);
	// ScriptProcessorNode needs a connected output to work
	processor.connect(audio_context.destination);
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

window.onload = Init;
