// Gilián Zoltán <gilian@caesar.elte.hu>, 2014
// Simplified BSD License

// Járai Antal: Bevezetés a matematikába című jegyzet alapján készült.
// Harmadik kiadás, ELTE Eötvös Kiadó, 2009, 332-334 p.,
// 9.2.44. FFT algoritmus.

// based on the discrete mathematics textbook 'Bevezetés a matematikába' by
// Antal Járai (hungarian).

var sin = Math.sin,
    cos = Math.cos,
    pi2 = Math.PI * 2,
    log2 = Math.log(2);

function ReverseBits(x, nbits) {
	var y = 0;
	for (var j = 0; j < nbits; ++j) {
		y <<= 1;
		y |= (x & 1);
		x >>= 1;
	}
	return y;
}

var FFTAlgorithm = function(num_bins) {
	this.Reset(num_bins);
}

FFTAlgorithm.prototype.CreateBitRevLUT = function() {
	this.bit_rev = new Int32Array(this.num_bins);
	for (var i = 0; i < this.num_bins; ++i) {
		this.bit_rev[i] = ReverseBits(i, this.num_bits);
	}
}

FFTAlgorithm.prototype.CreateRootOfUnityLUT = function() {
	var n = this.num_bins;
	this.rou = new Float32Array(n);
	for (var i = 0; i < (n >> 1); ++i) {
		var j = ReverseBits(i, this.num_bits - 1);
		this.rou[j << 1] = cos(pi2 * i / n);
		this.rou[j << 1 | 1] = -sin(pi2 * i / n);
	}
}

FFTAlgorithm.prototype.Reset = function(num_bins) {
	this.num_bits = Math.ceil(Math.log(num_bins) / log2),
	this.num_bins = 1 << this.num_bits;
	this.buffer = new Float32Array(2 * this.num_bins);
	this.CreateBitRevLUT();
	this.CreateRootOfUnityLUT();
}

FFTAlgorithm.prototype.Forward = function(array) {
	var n = this.num_bins;
	if (array.length != 2 * n) {
		throw 'FFTAlgorithm.Forward: array size should be ' + (2 * n).toString();
	}

	for (var l = this.num_bins >> 1; l > 0; l >>= 1) {
		for (var k = 0, t = 0; k < n; k += l + l, ++t) {
			var wr = this.rou[t << 1];
			var wi = this.rou[t << 1 | 1];
			for (var j = k; j < k + l; ++j) {
				var xr = array[j << 1];
				var xi = array[j << 1 | 1];
				var zr = array[(j + l) << 1];
				var zi = array[(j + l) << 1 | 1];
				var yr = wr * zr - wi * zi;
				var yi = wr * zi + wi * zr;
				array[j << 1] = xr + yr;
				array[j << 1 | 1] = xi + yi;
				array[(j + l) << 1] = xr - yr;
				array[(j + l) << 1 | 1] = xi - yi;
			}
		}
	}

	for (var i = 0; i < n; ++i) {
		var j = this.bit_rev[i];
		if (i < j) {
			var tr = array[i << 1];
			var ti = array[i << 1 | 1];
			array[i << 1] = array[j << 1];
			array[i << 1 | 1] = array[j << 1 | 1];
			array[j << 1] = tr;
			array[j << 1 | 1] = ti;
		}
	}
}
//
//var N = 16;
//var asdasd =  new FFTAlgorithm(N);
//var buf = new Float32Array(N << 1);
//for (var i = 0; i < N; ++i)
//	buf[i<<1] = i;
//asdasd.Forward(buf);
//for(var i = 0; i < N << 1; i += 2) {
//	console.log(buf[i].toString() + ' ' + buf[i + 1].toString());
//}

var FFT = (function(){

function twiddle (output, i, n, inverse) {
	var	phase	= (inverse ? pi2 : -pi2) * i / n;
	output[0]	= cos(phase);
	output[1]	= sin(phase);
}

function pass2 (input, output, inverse, product) {
	var	size		= input.length * .5,
		i		= 0,
		j		= 0,
		factor		= 2,
		m		= size / factor,
		q		= size / product,
		product1	= product / factor,
		jump		= (factor - 1) * product1,
		twidlz		= new Float32Array(2),
		k, k1, z0r, z0i, z1r, z1i, x0r, x0i, x1r, x1i;

		for (k=0; k<q; k++, j+= jump) {
			twiddle(twidlz, k, q * factor, inverse);

			for (k1=0; k1<product1; k1++, i++, j++) {
				z0r	= input[2 * i    ];
				z0i	= input[2 * i + 1];
				z1r	= input[2 * (i + m)    ];
				z1i	= input[2 * (i + m) + 1];
				x0r	= z0r + z1r;
				x0i	= z0i + z1i;
				x1r	= z0r - z1r;
				x1i	= z0i - z1i;

				output[2 * j    ]		= x0r;
				output[2 * j + 1]		= x0i;
				output[2 * (j + product1)    ]	= twidlz[0] * x1r - twidlz[1] * x1i;
				output[2 * (j + product1) + 1]	= twidlz[0] * x1i + twidlz[1] * x1r;
			}
		}
}

function fft (value, scratch, inverse) {
	var	product		= 1,
		state		= 0,
		size		= value.length * .5,
		factorCount	= Math.ceil(Math.log(size) / Math.log(2)),
		inp, out, i;

	for (i=0; i<factorCount; i++) {
		product		*= 2;
		
		state === 0 ? (inp = value, out = scratch, state = 1) : (inp = scratch, out = value, state = 0);
		pass2(inp, out, inverse, product);
	}

	if (inverse) {
		if (state === 1) {
			for (i=0; i<size; i++) {
				value[2 * i    ]	= scratch[2 * i    ];
				value[2 * i + 1]	= scratch[2 * i + 1];
			}
		}
	} else {
		if (state === 1) {
			for (i=0; i<size; i++) {
				value[2 * i    ]	= scratch[2 * i    ] / size;
				value[2 * i + 1]	= scratch[2 * i + 1] / size;
			}
		} else {
			for (i=0; i<size; i++) {
				value[2 * i    ]	= value[2 * i    ] / size;
				value[2 * i + 1]	= value[2 * i + 1] / size;
			}
		}
	}
}

function FFT () {
	this.reset.apply(this, arguments);
}

FFT.prototype = {
	scratch: null,
	bufferSize: 2048,

	reset: function (fftSize) {
		this.bufferSize	= isNaN(fftSize) ? this.bufferSize : 2 * fftSize;
		this.scratch	= new Float32Array(this.bufferSize);
	},

	forward: function (input) {
		FFT.process(input, this.scratch, true);
	},

	backward: function (input) {
		FFT.process(input, this.scratch, false);
	}
};

FFT.pass = {
	'2': pass2
};

FFT.supports = [2];

FFT.twiddle	= twiddle;
FFT.process	= fft;

return FFT;

}());
