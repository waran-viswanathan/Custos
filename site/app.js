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

if (guardianField) {
  const heroVerdict = guardianField.querySelector('.core strong');
  const heroPolicyState = document.getElementById('hero-policy-state');
  let nextVerdict = 'allow';

  function runEnforcementCycle() {
    guardianField.dataset.phase = 'request';
    delete guardianField.dataset.verdict;
    if (heroVerdict) heroVerdict.textContent = 'CHECK';
    if (heroPolicyState) heroPolicyState.textContent = 'EVALUATING';

    window.setTimeout(() => {
      guardianField.dataset.phase = 'verdict';
      guardianField.dataset.verdict = nextVerdict;
      const allowed = nextVerdict === 'allow';
      if (heroVerdict) heroVerdict.textContent = allowed ? 'ALLOW' : 'BLOCK';
      if (heroPolicyState) heroPolicyState.textContent = allowed ? 'MATCHED' : 'DENIED';
      nextVerdict = allowed ? 'block' : 'allow';
    }, reduceMotion ? 0 : 1350);
  }

  runEnforcementCycle();
  if (!reduceMotion) window.setInterval(runEnforcementCycle, 3900);
}

const contourFields = document.querySelectorAll('[data-contours]');
if (contourFields.length && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
  window.addEventListener('pointermove', (event) => {
    const x = ((event.clientX / window.innerWidth) - 0.5) * 24;
    const y = ((event.clientY / window.innerHeight) - 0.5) * 18;
    contourFields.forEach((field, index) => {
      const depth = index === 0 ? 1 : -0.55;
      field.style.setProperty('--contour-x', `${x * depth}px`);
      field.style.setProperty('--contour-y', `${y * depth}px`);
    });
  }, { passive: true });
}

const decisionConsole = document.getElementById('decision-console');
const killButton = document.getElementById('kill-button');
const consoleState = document.getElementById('console-state');
const decisionWord = document.getElementById('decision-word');
const decisionReason = document.getElementById('decision-reason');

killButton?.addEventListener('click', () => {
  const revoked = decisionConsole?.classList.toggle('revoked');
  decisionConsole?.classList.remove('system-event');
  window.requestAnimationFrame(() => decisionConsole?.classList.add('system-event'));
  window.setTimeout(() => decisionConsole?.classList.remove('system-event'), 700);
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

// Motion system: spatial feedback, live checkpoints, and lightweight game-like state.
if (!reduceMotion) {
  const progress = document.createElement('div');
  progress.className = 'system-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  function syncProgress() {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = distance > 0 ? Math.min(1, window.scrollY / distance) : 0;
    progress.style.transform = `scaleX(${ratio})`;
  }
  syncProgress();
  window.addEventListener('scroll', syncProgress, { passive: true });

  const motionCards = document.querySelectorAll('.question-card, .role-card, .wallet-status, .layer-card, .action-card, .metric, .proof-row, .principle');
  motionCards.forEach((card) => card.classList.add('motion-card'));

  const protocolLayers = [...document.querySelectorAll('.layer-card')];
  let activeLayer = 0;
  function advanceLayer() {
    protocolLayers.forEach((layer, index) => layer.classList.toggle('system-active', index === activeLayer));
    activeLayer = (activeLayer + 1) % protocolLayers.length;
  }
  if (protocolLayers.length) {
    advanceLayer();
    window.setInterval(advanceLayer, 1650);
  }

  const metrics = document.querySelectorAll('.metric strong');
  const metricObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const metric = entry.target;
      const raw = metric.textContent.trim();
      if (!/^\d+$/.test(raw)) {
        observer.unobserve(metric);
        return;
      }
      const target = Number(raw);
      const pad = raw.length;
      const duration = 950;
      const started = performance.now();
      metric.closest('.metric')?.classList.add('counting');
      function tick(now) {
        const progressValue = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progressValue, 3);
        metric.textContent = String(Math.round(target * eased)).padStart(pad, '0');
        if (progressValue < 1) {
          window.requestAnimationFrame(tick);
        } else {
          metric.closest('.metric')?.classList.remove('counting');
        }
      }
      window.requestAnimationFrame(tick);
      observer.unobserve(metric);
    });
  }, { threshold: 0.55 });
  metrics.forEach((metric) => metricObserver.observe(metric));

  const checkpoints = [
    ['.hero', 'TOP'],
    ['#console', 'WALLET'],
    ['#protocol', 'STACK'],
    ['#decision', 'GATE'],
    ['#markets', 'ACTIONS'],
    ['#integration', 'CODE'],
    ['#evidence', 'PROOF'],
    ['#pilot', 'PILOT']
  ].map(([selector, label]) => ({ element: document.querySelector(selector), label })).filter(({ element }) => element);

  if (checkpoints.length) {
    const rail = document.createElement('aside');
    rail.className = 'system-rail';
    rail.setAttribute('aria-label', 'Page checkpoints');
    checkpoints.forEach(({ element, label }, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.index = String(index + 1).padStart(2, '0');
      button.setAttribute('aria-label', label);
      button.addEventListener('click', () => element.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      rail.append(button);
    });
    document.body.append(rail);
    const railButtons = [...rail.querySelectorAll('button')];
    const checkpointObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = checkpoints.findIndex(({ element }) => element === entry.target);
        railButtons.forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === index));
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    checkpoints.forEach(({ element }) => checkpointObserver.observe(element));
    railButtons[0]?.classList.add('active');
  }
}
