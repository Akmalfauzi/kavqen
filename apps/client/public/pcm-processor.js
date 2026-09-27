// pcm-processor.js - AudioWorklet that captures PCM16 at 24kHz in 50ms chunks (1200 samples)
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 24000 Hz * 0.05s = 1200 samples (50ms optimal streaming chunk size)
    this.CHUNK_SIZE = 1200;
    this.buffer = new Int16Array(this.CHUNK_SIZE);
    this.bufferIndex = 0;
    this.ratio = sampleRate / 24000;
    this.position = 0;
    this.previous = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      // Preserve fractional position across render blocks, including at 44.1 kHz.
      while (this.position < input.length - 1) {
        const i = Math.floor(this.position);
        const fraction = this.position - i;
        const left = i < 0 ? this.previous : input[i];
        const interpolated = left + (input[i + 1] - left) * fraction;
        // Convert Float32 [-1, 1] to Int16
        const sample = Math.max(-1, Math.min(1, interpolated));
        this.buffer[this.bufferIndex++] = sample < 0 ? sample * 32768 : sample * 32767;

        if (this.bufferIndex >= this.CHUNK_SIZE) {
          // Post 50ms chunk
          const chunk = this.buffer.buffer.slice(0);
          this.port.postMessage(chunk, [chunk]);
          this.bufferIndex = 0;
        }
        this.position += this.ratio;
      }
      this.position -= input.length;
      this.previous = input[input.length - 1];
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
