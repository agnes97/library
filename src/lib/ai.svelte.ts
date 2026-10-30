import { request } from './api';
import type { AiKey, AiKeys, AiProvider } from './types';

const NONE: AiKeys = { openai: null };

/** the AI services a reader can connect, as the menu lists them */
export const providers: { id: AiProvider; label: string }[] = [{ id: 'openai', label: 'ChatGPT' }];

/** The AI services the reader connected with their own API keys, e.g. ChatGPT to draw spines. */
class Ai {
  keys = $state.raw<AiKeys>(NONE);
  status = $state<'idle' | 'loading' | 'error'>('idle');

  /** whether any provider is connected */
  anyConnected = $derived(Object.values(this.keys).some((key) => key !== null));

  connected(provider: AiProvider): boolean {
    return this.keys[provider] !== null;
  }

  async load() {
    this.status = 'loading';
    try {
      this.keys = await request<AiKeys>('/ai/keys');
      this.status = 'idle';
    } catch {
      this.status = 'error';
    }
  }

  /** Checks the key with its provider and keeps it, throwing the reason when it is refused. */
  async connect(provider: AiProvider, key: string) {
    const stored = await request<AiKey>(`/ai/keys/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ key }),
    });
    this.keys = { ...this.keys, [provider]: stored };
  }

  async disconnect(provider: AiProvider) {
    await request(`/ai/keys/${provider}`, { method: 'DELETE' });
    this.keys = { ...this.keys, [provider]: null };
  }

  clear() {
    this.keys = NONE;
    this.status = 'idle';
  }
}

export const ai = new Ai();
