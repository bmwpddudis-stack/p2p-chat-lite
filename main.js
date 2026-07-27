import { initChat } from './chat-logic.js';

const peer = new Peer();
const lobby = document.getElementById('lobby');
const chatView = document.getElementById('chat-view');
const lobbyStatus = document.getElementById('lobby-status');
const userNickEl = document.getElementById('user-nick');
const copyInviteLinkBtn = document.getElementById('copy-invite-link');

const messagesEl = document.getElementById('messages');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const imageInput = document.getElementById('image-input');

peer.on('open', (id) => {
  lobbyStatus.textContent = 'ID получен — можно приглашать';
  // PeerID больше не показываем, он только внутри ссылки
});

copyInviteLinkBtn.onclick = () => {
  const id = peer.id; // берём PeerID «под капотом»
  if (!id) return;
  const nick = encodeURIComponent(userNickEl.value.trim() || 'Аноним');
  const base = `${window.location.origin}${window.location.pathname}`;
  const inviteLink = `${base}?room=${encodeURIComponent(id)}&nick=${nick}`;
  navigator.clipboard.writeText(inviteLink).then(() => alert('Ссылка скопирована!'));
};

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const senderNick = urlParams.get('nick') || 'Собеседник';

// Если зашли по ссылке с room=PeerID — сразу пытаемся подключиться
if (roomId) {
  // Создаём временное соединение, чтобы принять входящее или инициировать исходящее
  const chat = initChat(peer, messagesEl, textInput, sendBtn, imageInput, userNickEl);

  chat.onConnection(() => {
    lobby.style.display = 'none';
    chatView.style.display = 'block';
    lobbyStatus.textContent = 'Чат активен';
  });

  // Если ты хост (у тебя есть ник в URL), ты ждёшь подключения.
  // Если ты гость (просто открыл ссылку) — ты подключаешься к roomId.
  // Для простоты: если есть roomId, пробуем подключиться к нему.
  chat.connectTo(roomId);
} else {
  // Ты хост: просто ждёшь, пока кто-то подключится
  const chat = initChat(peer, messagesEl, textInput, sendBtn, imageInput, userNickEl);

  chat.onConnection(() => {
    lobby.style.display = 'none';
    chatView.style.display = 'block';
    lobbyStatus.textContent = 'Чат активен';
  });
}
