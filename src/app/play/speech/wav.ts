// Pure audio helpers: downsample mic audio to 16 kHz and wrap it as a mono 16-bit WAV.

/** Averages each output step's worth of input samples. Fine for speech; no filtering tricks. */
export function downsample(input: Float32Array, fromRate: number, toRate = 16000): Float32Array {
  if (fromRate <= toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j] ?? 0;
    out[i] = sum / (end - start);
  }
  return out;
}

/** RIFF/WAVE, PCM, mono, 16-bit. Samples are clamped to [-1, 1]. */
export function encodeWav(samples: Float32Array, rate = 16000): Uint8Array {
  const dataBytes = samples.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const v = new DataView(out.buffer);
  const tag = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
  };
  tag(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i] ?? 0));
    v.setInt16(44 + i * 2, x < 0 ? Math.round(x * 32768) : Math.round(x * 32767), true);
  }
  return out;
}
