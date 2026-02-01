import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { arrayBufferToBase64, base64ToUint8Array } from "./audioUtils";

export interface ChefActions {
  nextStep: () => void;
  previousStep: () => void;
  repeatInstruction: () => void;
  startTimer: (durationSeconds?: number) => void;
  stopTimer: () => void;
}

interface LiveChefConfig {
  onAudioData: (audioData: ArrayBuffer) => void;
  onClose: () => void;
  language: string;
  systemInstruction?: string;
  actions: ChefActions;
  voiceName: string; 
}

const toolsDef: FunctionDeclaration[] = [
  {
    name: "nextStep",
    description: "Move to the next cooking step or instruction.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "previousStep",
    description: "Go back to the previous cooking step.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "repeatInstruction",
    description: "Repeat the current cooking instruction or read it again.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "startTimer",
    description: "Start a timer. If no duration is specified, use the default time for the current step.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        durationSeconds: {
          type: Type.NUMBER,
          description: "Duration in seconds (optional)",
        },
      },
    },
  },
  {
    name: "stopTimer",
    description: "Stop or pause the currently running timer.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

export class LiveChefService {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected: boolean = false;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API Key not found");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(config: LiveChefConfig) {
    const { onAudioData, onClose, language, systemInstruction, actions, voiceName } = config;

    await this.disconnect();

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000, 
    });

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("Microphone access denied", e);
      throw e;
    }

    const defaultInstruction = `You are a friendly, helpful AI Chef Assistant for the "Vibe Cooking" app. 
          You are talking to a user who is currently cooking. 
          You have access to tools to control the app navigation and timers. Use them when the user asks (e.g., "Next step", "Set a timer").
          Answer questions about cooking steps, ingredients, substitutions, and techniques concisely and encouragingly. 
          Language: ${language}. Voice: ${voiceName}.`;

    try {
      this.isConnected = true;
      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Live Chef Connected");
            if (this.isConnected) {
              this.startAudioStreaming(sessionPromise);
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (!this.isConnected) return;

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const audioBytes = base64ToUint8Array(base64Audio);
              onAudioData(audioBytes.buffer);
            }

            if (message.toolCall) {
              this.handleToolCalls(message.toolCall, actions, sessionPromise);
            }

            if (message.serverContent?.interrupted) {
            }
          },
          onclose: () => {
            console.log("Live Chef Disconnected");
            this.isConnected = false;
            onClose();
          },
          onerror: (err) => {
            console.error("Live Chef Error", err);
            this.isConnected = false;
            onClose();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
          systemInstruction: systemInstruction || defaultInstruction,
          tools: [{ functionDeclarations: toolsDef }],
        }
      });

      this.session = sessionPromise;
      
      sessionPromise.catch(e => {
        console.error("Connection failed", e);
        this.disconnect();
        onClose();
      });

      return sessionPromise;
    } catch (e) {
      console.error("Failed to establish Live API connection", e);
      this.isConnected = false;
      onClose();
      throw e;
    }
  }

  private handleToolCalls(toolCall: any, actions: ChefActions, sessionPromise: Promise<any>) {
    const functionCalls = toolCall.functionCalls;
    if (!functionCalls || functionCalls.length === 0) return;

    const functionResponses = [];

    for (const call of functionCalls) {
      console.log("Executing Tool:", call.name, call.args);
      let result = "Done";

      try {
        switch (call.name) {
          case "nextStep":
            actions.nextStep();
            result = "Moved to next step.";
            break;
          case "previousStep":
            actions.previousStep();
            result = "Moved to previous step.";
            break;
          case "repeatInstruction":
            actions.repeatInstruction();
            result = "Repeating instruction.";
            break;
          case "startTimer":
            const duration = call.args?.durationSeconds;
            actions.startTimer(duration);
            result = duration ? `Timer started for ${duration} seconds.` : "Timer started.";
            break;
          case "stopTimer":
            actions.stopTimer();
            result = "Timer stopped.";
            break;
          default:
            console.warn("Unknown tool:", call.name);
            result = "Unknown command.";
        }
      } catch (e) {
        console.error("Tool execution failed", e);
        result = "Failed to execute command.";
      }

      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { result: result },
      });
    }

    sessionPromise.then(session => {
      if (this.isConnected) {
        session.sendToolResponse({
          functionResponses: functionResponses
        });
      }
    }).catch(e => {
    });
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.audioContext || !this.mediaStream) return;

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const base64 = arrayBufferToBase64(pcmData.buffer);

      sessionPromise.then(session => {
        if (this.isConnected) {
          session.sendRealtimeInput({
            media: {
              mimeType: "audio/pcm;rate=16000",
              data: base64
            }
          });
        }
      }).catch(e => {
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  async disconnect() {
    this.isConnected = false;
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try { await this.audioContext.close(); } catch(e) {}
      this.audioContext = null;
    }

    if (this.session) {
       try {
         const session = await this.session;
         if (session && typeof session.close === 'function') {
           await session.close();
         }
       } catch (e) {
       }
       this.session = null;
    }
  }
}