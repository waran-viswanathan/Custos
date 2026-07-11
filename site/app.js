const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('.mobile-menu');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function syncHeader() {
  header?.classList.toggle('scrolled', window.scrollY > 18);
}

syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  mobileMenu?.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
});

mobileMenu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Open navigation');
    mobileMenu.classList.remove('open');
    document.body.classList.remove('menu-open');
  });
});

if (!reduceMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
}

const guardianField = document.getElementById('guardian-field');
if (guardianField && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
  guardianField.addEventListener('pointermove', (event) => {
    const rect = guardianField.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -7;
    guardianField.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg)`;
  });
  guardianField.addEventListener('pointerleave', () => {
    guardianField.style.transform = '';
  });
}

const decisionConsole = document.getElementById('decision-console');
const killButton = document.getElementById('kill-button');
const consoleState = document.getElementById('console-state');
const decisionWord = document.getElementById('decision-word');
const decisionReason = document.getElementById('decision-reason');

killButton?.addEventListener('click', () => {
  const revoked = decisionConsole?.classList.toggle('revoked');
  if (!consoleState || !decisionWord || !decisionReason) return;

  consoleState.textContent = revoked ? 'AGENT REVOKED' : 'AGENT VERIFIED';
  decisionWord.textContent = revoked ? 'BLOCK' : 'ALLOW';
  decisionReason.textContent = revoked
    ? 'Credential revocation cascades into the mandate and blocks the action before settlement.'
    : 'All credential, mandate, signature, and issuer policy checks passed.';
  const title = killButton.querySelector('b');
  const detail = killButton.querySelector('small');
  if (title) title.textContent = revoked ? 'Restore demonstration' : 'Trigger kill switch';
  if (detail) detail.textContent = revoked ? 'Return to the permitted state' : 'See revocation propagate';
});

const copyButton = document.getElementById('copy-code');
const issuerCode = document.getElementById('issuer-code');
copyButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(issuerCode?.innerText || '');
    copyButton.textContent = 'Copied';
    window.setTimeout(() => { copyButton.textContent = 'Copy code'; }, 1400);
  } catch {
    copyButton.textContent = 'Select to copy';
  }
});

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
