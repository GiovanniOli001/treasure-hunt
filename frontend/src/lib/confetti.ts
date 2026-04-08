const COLORS = ['#f57e20', '#3aa9e0', '#357cc0', '#16a34a', '#eab308', '#ef4444', '#8b5cf6'];

export function launchConfetti(containerId = 'confetti-container') {
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    Object.assign(container.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9999',
      overflow: 'hidden',
    });
    document.body.appendChild(container);
  }

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    Object.assign(piece.style, {
      position: 'absolute',
      width: `${Math.random() * 8 + 6}px`,
      height: `${Math.random() * 8 + 6}px`,
      top: '-10px',
      left: `${Math.random() * 100}%`,
      background: COLORS[Math.floor(Math.random() * COLORS.length)],
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      animation: `confettiFall ${Math.random() * 2 + 1.5}s ${Math.random() * 0.8}s linear forwards`,
    });
    container.appendChild(piece);
  }

  setTimeout(() => {
    if (container) container.innerHTML = '';
  }, 4000);
}

// Inject keyframes once
const style = document.createElement('style');
style.textContent = `
@keyframes confettiFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}`;
document.head.appendChild(style);
