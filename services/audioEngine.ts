
export class AudioEngine {
  public context: AudioContext;
  public analyzer: AnalyserNode;
  private source: MediaElementAudioSourceNode;
  private gainNode: GainNode;
  public eqNodes: BiquadFilterNode[] = [];
  
  private frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  constructor(audioElement: HTMLAudioElement) {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyzer = this.context.createAnalyser();
    this.analyzer.fftSize = 2048;
    this.analyzer.smoothingTimeConstant = 0.8;

    this.source = this.context.createMediaElementSource(audioElement);
    this.gainNode = this.context.createGain();

    // Create EQ nodes
    let lastNode: AudioNode = this.source;
    this.frequencies.forEach((freq) => {
      const filter = this.context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      
      lastNode.connect(filter);
      this.eqNodes.push(filter);
      lastNode = filter;
    });

    lastNode.connect(this.gainNode);
    this.gainNode.connect(this.analyzer);
    this.analyzer.connect(this.context.destination);
  }

  public getFrequencyData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public getTimeDomainData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  public setEQ(index: number, gain: number) {
    if (this.eqNodes[index]) {
      this.eqNodes[index].gain.setTargetAtTime(gain, this.context.currentTime, 0.1);
    }
  }

  public resume() {
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  // Simple peak detection for rhythm game
  public getEnergy(minFreq: number, maxFreq: number): number {
    const data = this.getFrequencyData();
    const nyquist = this.context.sampleRate / 2;
    const minBin = Math.floor(minFreq / nyquist * data.length);
    const maxBin = Math.floor(maxFreq / nyquist * data.length);
    
    let sum = 0;
    for (let i = minBin; i <= maxBin; i++) {
      sum += data[i];
    }
    return sum / (maxBin - minBin + 1);
  }
}
