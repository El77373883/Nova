const messagesContainer = document.getElementById('messagesContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = userInput.value.trim();
  if (!question) return;

  // Agregar mensaje del usuario al chat
  addMessage(question, 'user');
  userInput.value = '';
  sendButton.disabled = true;

  // Mostrar indicador de escritura
  const typingId = showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (!response.ok) throw new Error('Error en la respuesta del servidor');

    const data = await response.json();
    removeTypingIndicator(typingId);
    addMessage(data.answer, 'assistant');
  } catch (error) {
    removeTypingIndicator(typingId);
    addMessage('Error: No se pudo conectar con el servidor de conocimiento.', 'assistant');
    console.error(error);
  } finally {
    sendButton.disabled = false;
    userInput.focus();
  }
});

function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;

  const avatarIcon = sender === 'user' ? 'fa-user' : 'fa-cloud';
  const senderName = sender === 'user' ? 'Usted' : 'Nova';

  messageDiv.innerHTML = `
    <div class="avatar">
      <i class="fas ${avatarIcon}"></i>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">${senderName}</span>
      </div>
      <div class="message-bubble">
        <p>${escapeHtml(text)}</p>
      </div>
    </div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  const typingDiv = document.createElement('div');
  typingDiv.id = id;
  typingDiv.className = 'message assistant';
  typingDiv.innerHTML = `
    <div class="avatar">
      <i class="fas fa-cloud"></i>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">Nova</span>
      </div>
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const element = document.getElementById(id);
  if (element) element.remove();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
