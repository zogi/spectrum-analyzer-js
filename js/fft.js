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
