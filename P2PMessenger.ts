import { DataChannel, Connection } from 'peerjs';

export class P2PMessenger {
  private peer: Peer;
  private dc: DataChannel | null = null;
  private messagesContainer: HTMLElement;
  private inputField: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private fileInput: HTMLInputElement;
  private myNick: string;

  constructor(
    peer: Peer,
    messagesContainer: HTMLElement,
    inputField: HTMLInputElement,
    sendButton: HTMLButtonElement,
    fileInput: HTMLInputElement,
    myNick: string
  ) {
    this.peer = peer;
    this.messagesContainer = messagesContainer;
    this.inputField = inputField;
    this.sendButton = sendButton;
    this.fileInput = fileInput;
    this.myNick = myNick;
  }

  public setupConnection(): void {
    this.peer.on('open', (id: string) => {
      console.log('Peer ID:', id);
      // ID используется внутри, пользователю не показывается
    });

    this.peer.on('connection', (conn: Connection) => {
      this.handleIncomingConnection(conn);
    });

    // Обработчик отправки по Enter
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage(this.inputField.value.trim());
      }
    });

    // Кнопка отправки
    this.sendButton.addEventListener('click', () => {
      const text = this.inputField.value.trim();
      if (text) this.sendMessage(text);
    });

    // Загрузка файлов (картинки/файлы)
    this.fileInput.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        await this.sendFile(file);
      }

      this.fileInput.value = ''; // сброс
    });
  }

  private handleIncomingConnection(conn: Connection): void {
    const dataChannel = conn.dc || conn.createDataChannel('chat');
    
    dataChannel.onopen = () => {
      this.dc = dataChannel;
      console.log('Data channel opened');
      this.appendSystemMessage('Чат активен');
    };

    dataChannel.onmessage = (event: any) => {
      const data = event.data;
      
      if (data instanceof Blob) {
        // Это файл или картинка
        this.handleIncomingFile(data);
      } else if (typeof data === 'string') {
        try {
          const payload = JSON.parse(data);
          if (payload.type === 'text') {
            this.appendMessage(payload.text, payload.nick, 'other');
          } else if (payload.type === 'image') {
            this.appendImageMessage(payload.blob, payload.nick, 'other');
          } else if (payload.type === 'file') {
            this.appendFileMessage(payload.blob, payload.fileName, payload.mimeType, payload.nick, 'other');
          }
        } catch {
          // Если не JSON — считаем обычным текстом
          this.appendMessage(data, 'Собеседник', 'other');
        }
      }
    };

    conn.onerror = (err: Error) => console.error('Connection error:', err);
  }

  public connectTo(partnerId: string): void {
    const conn = this.peer.connect(partnerId);
    this.handleIncomingConnection(conn);
  }

  // --- Отправка ---

  private async sendMessage(text: string): Promise<void> {
    if (!this.dc || this.dc.readyState !== 'open') {
      this.appendSystemMessage('Нет активного соединения');
      return;
    }

    const payload = {
      type: 'text',
      text,
      nick: this.myNick
    };

    this.dc.send(JSON.stringify(payload));
    this.appendMessage(text, this.myNick, 'me');
    this.inputField.value = '';
  }

  private async sendFile(file: File): Promise<void> {
    if (!this.dc || this.dc.readyState !== 'open') {
      this.appendSystemMessage('Нет активного соединения');
      return;
    }

    const blob = await file.arrayBuffer().then(ab => new Blob([ab], { type: file.type }));

    let payload: any;

    if (file.type.startsWith('image/')) {
      payload = {
        type: 'image',
        blob,
        nick: this.myNick
      };
      this.appendImageMessage(blob, this.myNick, 'me');
    } else {
      payload = {
        type: 'file',
        blob,
        fileName: file.name,
        mimeType: file.type,
        nick: this.myNick
      };
      this.appendFileMessage(blob, file.name, file.type, this.myNick, 'me');
    }

    // Для Blob нельзя отправить напрямую в send() в некоторых браузерах как часть JSON,
    // поэтому отправляем метаданные, а Blob отдельно или через бинарный канал.
    // В PeerJS DataChannel send() принимает Blob напрямую.
    // Здесь мы отправляем метаданные как JSON, а затем Blob.
    
    const metaPayload = { ...payload, blob: undefined }; // без blob в JSON
    this.dc.send(JSON.stringify(metaPayload));
    this.dc.send(blob); // отправляем Blob отдельным пакетом
  }

  // --- Рендеринг ---

  private appendSystemMessage(text: string): void {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system';
    msgDiv.textContent = text;
    this.messagesContainer.appendChild(msgDiv);
    this.scrollToBottom();
  }

  public appendMessage(text: string, nick: string, sender: 'me' | 'other'): void {
    const container = document.createElement('div');
    container.className = `message ${sender}`;

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = nick;

    const body = document.createElement('div');
    body.className = 'message-body';
    body.textContent = text;

    container.appendChild(header);
    container.appendChild(body);
    this.messagesContainer.appendChild(container);
    this.scrollToBottom();
  }

  public appendImageMessage(blob: Blob, nick: string, sender: 'me' | 'other'): void {
    const url = URL.createObjectURL(blob);

    const container = document.createElement('div');
    container.className = `message ${sender}`;

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = nick;

    const img = document.createElement('img');
    img.src = url;
    img.className = 'message-image';
    img.onload = () => URL.revokeObjectURL(url); // освобождаем память после загрузки
    img.onerror = () => URL.revokeObjectURL(url);

    container.appendChild(header);
    container.appendChild(img);
    this.messagesContainer.appendChild(container);
    this.scrollToBottom();
  }

  public appendFileMessage(
    blob: Blob,
    fileName: string,
    mimeType: string,
    nick: string,
    sender: 'me' | 'other'
  ): void {
    const container = document.createElement('div');
    container.className = `message ${sender}`;

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = nick;

    const fileBlock = document.createElement('div');
    fileBlock.className = 'message-file';

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = '📄';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = fileName;

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = fileName;
    downloadLink.textContent = 'Скачать';
    downloadLink.className = 'file-download';
    downloadLink.onclick = (e) => e.stopPropagation(); // чтобы клик не триггерил сообщение

    fileBlock.appendChild(icon);
    fileBlock.appendChild(nameSpan);
    fileBlock.appendChild(downloadLink);

    container.appendChild(header);
    container.appendChild(fileBlock);
    this.messagesContainer.appendChild(container);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 0);
  }

  private handleIncomingFile(blob: Blob): void {
    // Упрощённо: пытаемся определить тип и рендерить.
    // В реальном проекте лучше передавать тип вместе с Blob.
    if (blob.type.startsWith('image/')) {
      this.appendImageMessage(blob, 'Собеседник', 'other');
    } else {
      // Для файлов нужен fileName — тут заглушка
      this.appendFileMessage(blob, 'файл', blob.type, 'Собеседник', 'other');
    }
  }
}
