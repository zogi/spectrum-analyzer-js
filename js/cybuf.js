// Gilián Zoltán <gilian@caesar.elte.hu>, 2014

var Float32CyclicBuffer = function(block_size, block_count) {
	this.block_size = block_size;
	this.block_count = block_count;
	this.head = 0;
	this.size = 0;
	this.buffer_size = block_size * block_count;
	this.buffer = new Float32Array(this.buffer_size);
	this.Push = function(block_data) {
		if (block_data.length != this.block_size) {
			throw 'the length of "block_data" should be ' + this.block_size.toString();
		}
		for (var i = 0; i < this.block_size; ++i) {
			this.buffer[this.head + i] = block_data[i];
		}
		if (this.IsFilled()) {
			this.head += this.block_size;
			if (this.head == this.buffer_size) {
				this.head = 0;
			}
		} else {
			this.size += this.block_size;
		}
	}
	this.Get = function(i) {
		return this.buffer[(this.head + i) % this.buffer_size];
	}
	this.CopyBuffer = function(dest) {
		for (var i = 0; i < this.size; i++) {
			dest[i] = this.Get(i);
		}
	}
	this.IsFilled = function() {
		return this.size == this.buffer_size;
	}
}
