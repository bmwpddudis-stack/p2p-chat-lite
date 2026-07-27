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

// Инициализируем чат один раз
const chat = initChat(peer, messagesEl, textInput, sendBtn, imageInput, userNickEl);

peer.on('open', (id) => {
  lobbyStatus.textContent = 'ID получен — можно приглашать';
});

copyInviteLinkBtn.onclick = () => {
  const id = peer.id;
  if (!id) return;
  const nick = encodeURIComponent(userNickEl.value.trim() || 'Аноним');
  const base = `${window.location.origin}${window.location.pathname}`;
  const inviteLink = `${base}?room=${encodeURIComponent(id)}&nick=${nick}`;
  navigator.clipboard.writeText(inviteLink).then(() => alert('Ссылка скопирована!'));
};

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

chat.onConnection(() => {
  lobby.style.display = 'none';
  chatView.style.display = 'block';
  lobbyStatus.textContent = 'Чат активен';
});

if (roomId) {
  // Если зашли по ссылке с room=ID — пытаемся подключиться к этому ID
  chat.connectTo(roomId);
} else {
  // Иначе просто ждём входящих подключений
  // (ничего дополнительно делать не надо, onConnection уже настроен)
}
