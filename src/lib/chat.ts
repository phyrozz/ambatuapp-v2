export type ChatConversation = { id: string; members: string[]; group: boolean; title: string; names: Record<string, string>; updatedAt: number; lastMessage?: string };
export type ChatMessage = { id: string; conversationId: string; senderId: string; kind: 'text' | 'image' | 'video' | 'gif' | 'sound'; text: string; url?: string; createdAt: number };

type ResponseBody = { event: 'response'; requestId: string; data?: Record<string, unknown>; error?: string };
type MessageBody = { event: 'message'; message: ChatMessage };
type ConversationBody = { event: 'conversation'; conversationId: string };

export class ChatSocket {
  private socket: WebSocket | null = null;
  private pending = new Map<string, { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  onMessage?: (message: ChatMessage) => void;
  onConversation?: () => void;
  onClose?: () => void;

  async connect(url: string, token: string) {
    const socket = new WebSocket(url);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('socket'));
    });
    socket.onmessage = (event) => {
      const body = JSON.parse(String(event.data)) as ResponseBody | MessageBody | ConversationBody;
      if (body.event === 'message') { this.onMessage?.(body.message); return; }
      if (body.event === 'conversation') { this.onConversation?.(); return; }
      const pending = this.pending.get(body.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(body.requestId);
      if (body.error) pending.reject(new Error(body.error)); else pending.resolve(body.data ?? {});
    };
    socket.onclose = () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('socket')); }
      this.pending.clear();
      this.onClose?.();
    };
    await this.request('authenticate', { token });
  }

  request(action: string, body: Record<string, unknown> = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('socket'));
    const requestId = crypto.randomUUID();
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('timeout')); }, 15000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ action, requestId, ...body }));
    });
  }

  close() { this.socket?.close(); }
}
