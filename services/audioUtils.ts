

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to decode raw PCM data (Int16, no header) into an AudioBuffer
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // IMPORTANT: Create a copy of the buffer slice to ensure byte alignment for Int16Array
  // If data.byteOffset is odd, new Int16Array(data.buffer) would throw or be misaligned.
  const bufferCopy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(bufferCopy);
  
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function pcmToWav(pcmData: Int16Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // write the PCM samples
  const offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset + i * 2, pcmData[i], true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function playAlarmSound(ctx: AudioContext, type: string) {
  // Add a small buffer to start time to prevent browser from dropping audio events
  // if they are scheduled too close to 'now' (especially on mobile/safari)
  const startTime = ctx.currentTime + 0.1;
  
  // Master gain for better volume control
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(1.0, startTime);

  if (type === 'soft-chime') {
    // Major 7th chord: C5, E5, G5, B5
    const freqs = [523.25, 659.25, 783.99, 987.77];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      // Use triangle for better audibility on small speakers compared to sine
      osc.type = 'triangle'; 
      osc.frequency.value = f;
      const noteGain = ctx.createGain();
      
      // Explicitly set start value to 0 to ensure ramp works
      noteGain.gain.setValueAtTime(0, startTime);
      
      osc.connect(noteGain);
      noteGain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 3.0);

      // Louder envelope: peak at 0.2 per oscillator (Total ~0.8)
      noteGain.gain.linearRampToValueAtTime(0.2, startTime + 0.1 + (i * 0.05)); 
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);
    });
  } else if (type === 'warm-gong') {
    const baseFreq = 220; // A3
    const partials = [1, 2.02, 3.05, 4.07]; 
    
    // Create a filter to warm it up
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.connect(masterGain);

    partials.forEach((p, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = baseFreq * p;
        const noteGain = ctx.createGain();
        
        noteGain.gain.setValueAtTime(0, startTime);
        
        osc.connect(noteGain);
        noteGain.connect(filter); // Connect to filter instead of master directly
        
        osc.start(startTime);
        osc.stop(startTime + 4.0);

        // Louder envelope
        const amp = 0.3 / (i + 1); 
        noteGain.gain.linearRampToValueAtTime(amp, startTime + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 3.5);
    });
  } else {
    // Classic Beep (Refined)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, startTime);
    osc.frequency.setValueAtTime(440, startTime + 0.3);
    
    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
    oscGain.gain.linearRampToValueAtTime(0.2, startTime + 0.3);
    oscGain.gain.linearRampToValueAtTime(0, startTime + 0.6);
    
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    
    osc.start(startTime);
    osc.stop(startTime + 0.6);
  }
}