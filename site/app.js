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

const walletWorkspace = document.getElementById('wallet-workspace');
const walletAddress = document.getElementById('wallet-address');
const walletNetwork = document.getElementById('wallet-network');
const walletEnvironment = document.getElementById('wallet-environment');
const walletMessage = document.getElementById('wallet-message');
const signProofButton = document.getElementById('sign-proof');
const controlStatus = document.getElementById('status-control');
const connectButtons = document.querySelectorAll('[data-connect-wallet]');
const provider = window.ethereum;
let activeAccount = '';

const chainNames = {
  '0x1': 'Ethereum',
  '0x2105': 'Base',
  '0x14a34': 'Base Sepolia'
};

function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function setWalletMessage(message, state = '') {
  if (!walletMessage) return;
  walletMessage.textContent = message;
  walletMessage.classList.remove('error', 'success');
  if (state) walletMessage.classList.add(state);
}

function resetControlProof() {
  controlStatus?.classList.remove('signed');
  const status = controlStatus?.querySelector('strong');
  const detail = controlStatus?.querySelector('p');
  if (status) status.textContent = activeAccount ? 'CONNECTED' : 'NOT CONNECTED';
  if (detail) detail.textContent = activeAccount ? 'Sign a local proof message to demonstrate wallet control.' : 'Connect, then sign a local proof message.';
}

async function renderWallet(account, chainId) {
  activeAccount = account || '';
  const chainName = chainNames[chainId] || `Chain ${Number.parseInt(chainId || '0', 16) || 'unknown'}`;
  const isPilotChain = chainId === '0x14a34';

  if (!activeAccount) {
    if (walletAddress) walletAddress.textContent = 'No wallet connected';
    if (walletNetwork) walletNetwork.textContent = 'Connect to identify the account and network.';
    if (walletEnvironment) walletEnvironment.textContent = 'BASE SEPOLIA · PILOT PENDING';
    signProofButton?.setAttribute('disabled', '');
    connectButtons.forEach((button) => { button.firstChild.textContent = 'Connect wallet '; });
    controlStatus?.classList.remove('connected');
    resetControlProof();
    return;
  }

  if (walletAddress) walletAddress.textContent = activeAccount;
  if (walletNetwork) walletNetwork.textContent = `${chainName} · ${shortAddress(activeAccount)}`;
  if (walletEnvironment) walletEnvironment.textContent = isPilotChain ? 'BASE SEPOLIA · WALLET READY' : `${chainName.toUpperCase()} · PILOT USES BASE SEPOLIA`;
  signProofButton?.removeAttribute('disabled');
  connectButtons.forEach((button) => { button.firstChild.textContent = `${shortAddress(activeAccount)} `; });
  controlStatus?.classList.add('connected');
  resetControlProof();
  setWalletMessage(isPilotChain
    ? 'Wallet connected. No transaction was sent. Sign the proof to demonstrate control.'
    : `Wallet connected on ${chainName}. The fresh Custos pilot will use Base Sepolia.`, 'success');
}

async function syncWallet(accounts) {
  if (!provider) return;
  const chainId = await provider.request({ method: 'eth_chainId' });
  await renderWallet(accounts?.[0] || '', chainId);
}

async function connectWallet() {
  walletWorkspace?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  if (!provider) {
    setWalletMessage('No browser wallet was detected. Install or enable a wallet such as MetaMask, Coinbase Wallet, or Rabby, then try again.', 'error');
    return;
  }

  setWalletMessage('Waiting for wallet approval…');
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    await syncWallet(accounts);
  } catch (error) {
    setWalletMessage(error?.code === 4001 ? 'Connection cancelled. Nothing changed.' : 'The wallet could not connect. Please try again.', 'error');
  }
}

connectButtons.forEach((button) => button.addEventListener('click', connectWallet));

signProofButton?.addEventListener('click', async () => {
  if (!provider || !activeAccount) return;
  const message = [
    'Custos wallet control proof',
    'Purpose: local console demonstration only',
    `Wallet: ${activeAccount}`,
    `Origin: ${window.location.origin}`,
    `Issued: ${new Date().toISOString()}`,
    'This is not a transaction and does not register a Custos credential.'
  ].join('\n');
  const hexMessage = `0x${Array.from(new TextEncoder().encode(message), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;

  setWalletMessage('Review the control-proof message in your wallet. This sends no transaction.');
  try {
    await provider.request({ method: 'personal_sign', params: [hexMessage, activeAccount] });
    controlStatus?.classList.add('signed');
    const status = controlStatus?.querySelector('strong');
    const detail = controlStatus?.querySelector('p');
    if (status) status.textContent = 'CONTROL PROVED';
    if (detail) detail.textContent = 'Signature completed locally. Registration still requires a server-issued, single-use challenge.';
    setWalletMessage('Control proof signed. The signature was not stored or submitted.', 'success');
  } catch (error) {
    setWalletMessage(error?.code === 4001 ? 'Signature cancelled. Nothing changed.' : 'The proof could not be signed. Please try again.', 'error');
  }
});

if (provider) {
  provider.request({ method: 'eth_accounts' }).then(syncWallet).catch(() => {});
  provider.on?.('accountsChanged', syncWallet);
  provider.on?.('chainChanged', async (chainId) => renderWallet(activeAccount, chainId));
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
