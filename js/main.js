let siteConfig = null;

const state = {
  introIndex: 0,
  introDone: false,
  noClicks: 0,
  yesChosen: false,
  noEvasiveEnabled: false,
  choices: {
    food: null,
    foodOther: "",
    flowers: null,
    flowersOther: "",
    sweets: null,
    sweetsOther: "",
    date: ""
  },
  audio: {
    enabled: false,
    bgm: null,
    yes: null,
    no: null,
    muted: true
  }
};

/**
 * Set a meme GIF on an <img> element, avoiding reloads if already set.
 *
 * @param {HTMLImageElement} imgEl - The target image element.
 * @param {string} relativePath - The relative path to the GIF.
 */
function setMemeGif(imgEl, relativePath) {
  if (!imgEl || !relativePath) return;
  const absolute = new URL(relativePath, window.location.href).href;
  if (imgEl.src === absolute) return; // don't reload same GIF
  imgEl.src = relativePath;
}

const STEPS = [
  {
    key: "food",
    title: "Food first 🍽️",
    subtitle: "Pick one and I’ll plan around it."
  },
  {
    key: "flowers",
    title: "Flowers 🌷",
    subtitle: "One bouquet coming right up."
  },
  {
    key: "sweets",
    title: "Sweet tooth 🍫",
    subtitle: "Pick your favorite."
  },
  {
    key: "date",
    title: "Pick a date 📅",
    subtitle: "When are you free?"
  }
];

function $(id) {
  return document.getElementById(id);
}

function formatTemplate(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] ?? `{${key}}`;
  });
}

/**
 * Switch the visible screen by toggling screen classes.
 *
 * Updates `aria-hidden` for accessibility and toggles the
 * `screen--active` class on the target screen.
 *
 * @param {string} activeId - The id of the screen to show.
 */
function setScreen(activeId) {
  const screens = document.querySelectorAll('.screen');
  for (const screen of screens) {
    const isActive = screen.id === activeId;
    screen.classList.toggle('screen--active', isActive);
    screen.setAttribute('aria-hidden', String(!isActive));
  }
}

/**
 * Load configuration from `config/site.config.json`.
 *
 * This populates the global `siteConfig` used throughout the app and
 * applies a configured page title if present.
 */
async function loadConfig() {
  const res = await fetch('config/site.config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load config');
  siteConfig = await res.json();

  // Apply title
  document.title = siteConfig.personal?.pageTitle || document.title;
}

/**
 * Initialize and animate the starfield background.
 *
 * Builds a field of stars based on the viewport size, then animates their
 * brightness in a subtle twinkling loop.
 */
function initStarfield() {
  const canvas = $('starfield');
  const ctx = canvas.getContext('2d');
  const stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function rebuild() {
    stars.length = 0;
    const count = Math.floor((window.innerWidth * window.innerHeight) / 3000);
    for (let i = 0; i < Math.min(600, Math.max(220, count)); i++) {
      stars.push({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        r: rand(0.4, 1.8),
        o: rand(0.2, 1.0),
        tw: rand(0.002, 0.01)
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const s of stars) {
      s.o += (Math.random() > 0.5 ? 1 : -1) * s.tw;
      s.o = Math.min(1, Math.max(0.15, s.o));

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.o})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  resize();
  rebuild();
  window.addEventListener('resize', () => {
    resize();
    rebuild();
  });

  requestAnimationFrame(draw);
}

/**
 * Initialize audio assets and mute toggle behavior.
 *
 * Loads audio elements from config, sets up mute state, and wires the
 * mute toggle button to control playback.
 */
function initAudio() {
  const muteToggle = $('mute-toggle');
  const cfg = siteConfig.media?.audio;
  state.audio.enabled = Boolean(cfg?.enabled);
  state.audio.muted = false;
  muteToggle.textContent = 'Music: Playing'

  if (!state.audio.enabled) {
    muteToggle.style.display = 'none';
    state.audio.muted = true;
    return;
  }

  const safeAudio = (url) => {
    if (!url) return null;
    const a = new Audio(url);
    a.loop = true;
    a.preload = 'auto';
    a.muted = state.audio.muted;
    return a;
  };

  state.audio.bgm = safeAudio(cfg.bgmUrl);
  state.audio.yes = safeAudio(cfg.yesUrl);
  state.audio.no = safeAudio(cfg.noUrl);

  muteToggle.addEventListener('click', () => {
    state.audio.muted = !state.audio.muted;
    const all = [state.audio.bgm, state.audio.yes, state.audio.no].filter(Boolean);
    for (const a of all) a.muted = state.audio.muted;
    muteToggle.textContent = state.audio.muted ? 'Music: Muted' : 'Music: Playing';
  });
}

/**
 * Play the background music if audio is enabled and not muted.
 *
 * If the BGM is already playing, this is a no-op.
 */
function playBgm() {
  if (!state.audio.enabled) return;
  if (state.audio.muted) return;
  const a = state.audio.bgm;
  if (!a) return;
  if (!a.paused) return;

  try {
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Play a sound cue (bgm/yes/no) and stop any currently playing audio.
 *
 * @param {'bgm'|'yes'|'no'} which - The audio cue to play.
 */
function playCue(which) {
  if (!state.audio.enabled) return;
  for (const key of ['bgm', 'yes', 'no']) {
    const a = state.audio[key];
    if (a && !a.paused) {
      a.pause();
      a.currentTime = 0;
    }
  }
  const a = state.audio[which];
  if (!a) return;

  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Initialize the welcome screen UI and start interaction.
 *
 * Sets up the personalized welcome message and listens for the first user
 * interaction to begin the intro sequence.
 */
function initWelcomeScreen() {
  const toName = siteConfig.personal?.toName;
  const fromName = siteConfig.personal?.fromName;
  const vars = { toName, fromName };

  const titleEl = $('welcome-title');
  const subtitleEl = $('welcome-subtitle');
  const gifEl = $('welcome-gif');

  titleEl.textContent = formatTemplate(siteConfig.personal?.welcomeTitle, vars);
  subtitleEl.textContent = formatTemplate(siteConfig.personal?.welcomeSubtitle, vars);
  setMemeGif(gifEl, siteConfig.media?.memeWelcomeGif);

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    setScreen('screen-intro');
    startIntro();
  };

  // Start on any tap/click anywhere on the page.
  document.addEventListener('pointerdown', start, { once: true, passive: true });
}

/**
 * Start the intro sequence.
 *
 * Displays a sequence of intro lines (with fade) and allows the user to
 * tap to advance faster. Once complete, it reveals the button to proceed.
 */
function startIntro() {
  const introLine = $('intro-line');
  const introSub = $('intro-sub');
  const btn = $('intro-continue');

  const vars = {
    toName: siteConfig.personal?.toName,
    fromName: siteConfig.personal?.fromName
  };

  const lines = (siteConfig.personal?.introLines || []).map((l) =>
    formatTemplate(l, vars)
  );

  state.introIndex = 0;
  state.introDone = false;
  playBgm();

  // Let user tap to speed up / finish
  const finish = () => {
    state.introDone = true;
    btn.style.display = 'inline-flex';
    introSub.textContent = '';
  };

  const advance = () => {
    if (state.introDone) return;

    const line = lines[state.introIndex] ?? lines[lines.length - 1];

    // Simple fade
    introLine.style.opacity = '0';
    setTimeout(() => {
      introLine.textContent = line;
      introLine.style.opacity = '1';
    }, 400);

    state.introIndex++;

    if (state.introIndex >= lines.length) {
      setTimeout(finish, 400);
    }
  };

  introLine.style.transition = 'opacity 620ms ease';
  introLine.textContent = lines[0];
  introSub.textContent = '';

  // Don’t repeat the first line on the first tick
  state.introIndex = Math.min(1, lines.length);

  // Automatic sequence (a little slower)
  const INTRO_STEP_MS = 4000;
  let timer = setInterval(() => {
    advance();
    if (state.introDone) {
      clearInterval(timer);
      timer = null;
    }
  }, INTRO_STEP_MS);

  // User can tap anywhere on intro to accelerate
  $('screen-intro').addEventListener(
    'click',
    () => {
      if (!state.introDone) {
        advance();
        clearInterval(timer);
        timer = setInterval(() => {
            advance();
            if (state.introDone) {
            clearInterval(timer);
            timer = null;
            }
        }, INTRO_STEP_MS);
      }
    },
    { passive: true }
  );

  btn.addEventListener('click', () => {
    setScreen('screen-question');
  });
}

/**
 * Initialize the question screen UI and behavior.
 *
 * Sets up the yes/no prompt, handles evasive "No" button behavior, and
 * transitions to the choice flow when the user accepts.
 */
function initQuestionScreen() {
  const vars = {
    toName: siteConfig.personal?.toName,
  };
  
  $('question-heading').textContent = formatTemplate(siteConfig.personal?.questionHeading, vars);

  $('yes-message-text').textContent = formatTemplate(siteConfig.personal?.yesMessage, vars);

  const meme = $('meme-gif');
  setMemeGif(meme, siteConfig.media?.memeQuestionGif);

  const yesBtn = $('yes-button');
  const noBtn = $('no-button');
  const buttonsWrap = $('question-buttons');

  const resetButtons = () => {
    state.noClicks = 0;
    state.noEvasiveEnabled = false;
    noBtn.classList.remove('evasive');
    noBtn.style.left = '';
    noBtn.style.top = '';
    yesBtn.style.width = '';
    yesBtn.style.height = '';
    yesBtn.style.fontSize = '';
    noBtn.textContent = 'No';
  };

  const enableEvasiveNo = () => {
    state.noEvasiveEnabled = true;
    noBtn.classList.add('evasive');
    // Make sure it starts somewhere sensible
    positionNoButton({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
  };

  const positionNoButton = (pointerEvent) => {
    if (!state.noEvasiveEnabled) return;

    const container = buttonsWrap;
    const containerRect = container.getBoundingClientRect();
    const btnRect = noBtn.getBoundingClientRect();

    const padding = 4;
    const maxX = Math.max(padding, containerRect.width - btnRect.width - padding);
    const maxY = Math.max(padding, containerRect.height - btnRect.height - padding);

    const px = pointerEvent?.clientX ?? (containerRect.left + containerRect.width / 2);
    const py = pointerEvent?.clientY ?? (containerRect.top + containerRect.height / 2);

    let x = padding;
    let y = padding;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = padding + Math.random() * (maxX - padding);
      y = padding + Math.random() * (maxY - padding);

      const cx = containerRect.left + x + btnRect.width / 2;
      const cy = containerRect.top + y + btnRect.height / 2;

      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 100) break;
    }

    noBtn.style.left = `${Math.round(x)}px`;
    noBtn.style.top = `${Math.round(y)}px`;
  };

  // Evasive behavior: move away when the pointer gets close
  window.addEventListener('pointermove', (e) => {
    if (!state.noEvasiveEnabled) return;

    const r = noBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - e.clientX;
    const dy = cy - e.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 170) {
      positionNoButton(e);
    }
  }, { passive: true });

  // Also jump away on hover/focus as a backup
  noBtn.addEventListener('pointerenter', (e) => {
    if (state.noEvasiveEnabled) positionNoButton(e);
  });

  noBtn.addEventListener('focus', (e) => {
    if (state.noEvasiveEnabled) positionNoButton(e);
  });

  noBtn.addEventListener('click', () => {
    if (state.yesChosen) return;

    // If we've completed the cycle and it reset, the No button becomes evasive.
    if (state.noEvasiveEnabled) {
      return;
    }

    if (state.noClicks === 0) playCue('no');

    state.noClicks++;

    const seq = siteConfig?.personal?.noSequence;
    const step = seq[Math.min(state.noClicks - 1, seq.length - 1)] || {};

    if (step.gif) setMemeGif(meme, step.gif);
    if (step.phrase) noBtn.textContent = step.phrase;

    if (step.reset) {
        resetButtons();
        enableEvasiveNo();
        setMemeGif(meme, siteConfig.media?.finalNoGif);
    }
  });

  yesBtn.addEventListener('click', () => {
    if (state.yesChosen) return;

    state.yesChosen = true;
    playCue('yes');

    if (siteConfig.media?.memeYesGif) {
      setMemeGif(meme, siteConfig.media.memeYesGif);
    }

    $('question-buttons').style.display = 'none';
    $('question-heading').textContent = siteConfig.personal?.yesMessageHead;
    $('yes-message').hidden = false;
  });

  $('start-choices').addEventListener('click', () => {
    setScreen('screen-choices');
    startChoicesFlow();
  });
}

/**
 * Starts the step-by-step choices flow (food, flowers, sweets, date).
 *
 * Renders each step to the screen, validates selections, and advances the user
 * through the flow until the review/submit screen.
 */
function startChoicesFlow() {
  let stepIndex = 0;

  const title = $('choice-title');
  const subtitle = $('choice-subtitle');
  const container = $('choices-container');
  const back = $('back-button');
  const next = $('next-button');
  const bar = $('progress-bar');

  function render() {
    const step = STEPS[stepIndex];
    const key = step.key;
    const list = siteConfig.choices?.[key] || [];

    title.textContent = step.title;
    subtitle.textContent = step.subtitle;

    const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
    bar.style.width = `${progress}%`;

    container.innerHTML = '';

    // Special step: date selector
    if (key === 'date') {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '6px';
      wrap.innerHTML = `
        <label style="display:block;color:rgba(255,255,255,0.8);margin:6px 2px 8px">Choose a date</label>
        <input id="date-input" type="date" style="width:100%;padding:12px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:white;outline:none" />
      `;
      container.appendChild(wrap);

      const input = wrap.querySelector('#date-input');
      input.value = state.choices.date || '';

      const openPicker = () => {
        try {
          input.focus();
          if (typeof input.showPicker === 'function') {
            input.showPicker();
          }
        } catch {
          // ignore
        }
      };

      input.addEventListener('click', openPicker);
      input.addEventListener('focus', openPicker);
      input.addEventListener('input', (e) => {
        state.choices.date = e.target.value;
      });

      back.disabled = stepIndex === 0;
      next.textContent = stepIndex === STEPS.length - 1 ? 'Review' : 'Next';
      return;
    }

    const selectedValue = state.choices[key];

    list.forEach((value) => {
      const el = document.createElement('div');
      el.className = 'choice' + (selectedValue === value ? ' choice--selected' : '');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');

      el.innerHTML = `
        <div class="choice__label">
          <span class="choice__name"></span>
          <span class="choice__pill">Tap</span>
        </div>
      `;

      el.querySelector('.choice__name').textContent = value;

      const select = () => {
        state.choices[key] = value;
        // Clear other text when switching away from "Something else"
        if (key === 'sweets') state.choices.sweetsOther = '';
        if (key === 'food') state.choices.foodOther = '';
        if (key === 'flowers') state.choices.flowersOther = '';
        render();
      };

      el.addEventListener('click', select);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });

      container.appendChild(el);
    });

    const renderOtherInput = (otherKey, labelText) => {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '8px';
      wrap.innerHTML = `
        <label style="display:block;color:rgba(255,255,255,0.8);margin:8px 2px 6px">${labelText}</label>
        <input id="other-input" type="text" placeholder="Type here…" style="width:100%;padding:12px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.18);color:white;outline:none" />
      `;
      container.appendChild(wrap);
      const input = wrap.querySelector('#other-input');
      input.value = state.choices[otherKey] || '';
      input.addEventListener('input', (e) => {
        state.choices[otherKey] = e.target.value;
      });
    };

    // Optional "Something else" text capture for sweets
    if (key === 'sweets' && state.choices.sweets === 'Something else (tell me)') {
      renderOtherInput('sweetsOther', 'What should I get?');
    }

    if (key === 'food' && state.choices.food === 'Something else (tell me)') {
      renderOtherInput('foodOther', 'What food should we do?');
    }

    if (key === 'flowers' && state.choices.flowers === 'Something else (tell me)') {
      renderOtherInput('flowersOther', 'What flowers should I get?');
    }

    back.textContent = stepIndex === 0 ? 'Back' : 'Back';
    back.disabled = stepIndex === 0;
    next.textContent = stepIndex === STEPS.length - 1 ? 'Review' : 'Next';
  }

  function validateCurrent() {
    const step = STEPS[stepIndex];
    const key = step.key;

    if (key === 'date') {
      return String(state.choices.date || '').trim().length > 0;
    }

    if (!state.choices[key]) return false;

    if (key === 'sweets' && state.choices.sweets === 'Something else (tell me)') {
      return state.choices.sweetsOther.trim().length > 0;
    }

    if (key === 'food' && state.choices.food === 'Something else (tell me)') {
      return state.choices.foodOther.trim().length > 0;
    }

    if (key === 'flowers' && state.choices.flowers === 'Something else (tell me)') {
      return state.choices.flowersOther.trim().length > 0;
    }

    return true;
  }

  back.addEventListener('click', () => {
    if (stepIndex === 0) return;
    stepIndex--;
    render();
  });

  next.addEventListener('click', () => {
    if (!validateCurrent()) {
      subtitle.textContent = 'Pick one (and fill the box if needed) 😊';
      return;
    }

    if (stepIndex < STEPS.length - 1) {
      stepIndex++;
      render();
      return;
    }

    // Review
    renderSummary();
    setScreen('screen-submit');
    if (state.review?.startCountdownAndMaybeSubmit) {
      state.review.startCountdownAndMaybeSubmit();
    }
  });

  render();
}

/**
 * Render the summary view showing the selected choices.
 *
 * This updates the summary UI with the current food/flowers/sweets/date
 * selections and clears any send/countdown status messages.
 */
function renderSummary() {
  const summary = $('summary');
  summary.innerHTML = '';

  const foodValue =
    state.choices.food === 'Something else (tell me)'
      ? state.choices.foodOther
      : state.choices.food;

  const flowersValue =
    state.choices.flowers === 'Something else (tell me)'
      ? state.choices.flowersOther
      : state.choices.flowers;

  const sweetValue =
    state.choices.sweets === 'Something else (tell me)'
      ? state.choices.sweetsOther
      : state.choices.sweets;

  const rows = [
    { label: 'Food', value: foodValue },
    { label: 'Flowers', value: flowersValue },
    { label: 'Sweet', value: sweetValue },
    { label: 'Date', value: state.choices.date }
  ];

  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'summary__row';
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector('strong').textContent = r.label;
    row.querySelector('span').textContent = r.value || '—';
    summary.appendChild(row);
  }

  const status = $('send-status');
  const countdown = $('countdown');
  if (status) status.textContent = '';
  if (countdown) countdown.textContent = '';
}

/**
 * Initializes the auto-review + submit flow for the choices screen.
 *
 * Handles rendering of the countdown UI, submitting the selected choices
 * (as a GitHub issue comment when enabled), and showing the final screen.
 *
 * @returns {{ startCountdownAndMaybeSubmit: () => void }} API for starting the countdown.
 */
function initAutoReviewAndSubmit() {
  const status = $('send-status');
  const countdownEl = $('countdown');

  let countdownTimer = null;
  let inFlight = false;

  function setStatus(msg) {
    status.textContent = msg;
  }

  /**
   * Build the comment body text to submit as a GitHub issue comment.
   *
   * This includes the selected choices (food, flowers, sweets, date),
   * as well as metadata like the page URL, user agent, and whether the
   * evasive "No" behavior was triggered.
   *
   * @returns {string} Formatted comment body text.
   */
  function buildCommentBody() {
    const personal = siteConfig.personal || {};

    const foodValue =
      state.choices.food === 'Something else (tell me)'
        ? state.choices.foodOther
        : state.choices.food;

    const flowersValue =
      state.choices.flowers === 'Something else (tell me)'
        ? state.choices.flowersOther
        : state.choices.flowers;

    const sweetValue =
      state.choices.sweets === 'Something else (tell me)'
        ? state.choices.sweetsOther
        : state.choices.sweets;

    const clientTimestamp = new Date().toISOString();
    const pageUrl = window.location.href;

    return [
      `New Valentine response (${clientTimestamp})`,
      '',
      `To: ${personal.toName || '—'}`,
      `From: ${personal.fromName || '—'}`,
      '',
      `No attempts: ${state.noEvasiveEnabled ? 'Max' : Number(state.noClicks || 0)}`,
      `No evasive enabled: ${state.noEvasiveEnabled ? 'Yes' : 'No'}`,
      '',
      `Food: ${foodValue || '—'}`,
      `Flowers: ${flowersValue || '—'}`,
      `Sweet: ${sweetValue || '—'}`,
      `Date: ${state.choices.date || '—'}`,
      '',
      `Page: ${pageUrl || '—'}`,
      `User-Agent: ${navigator.userAgent || '—'}`
    ].join('\n');
  }

  /**
   * Submit the current selections to GitHub as an issue comment (if enabled).
   *
   * Uses AES decryption of an encrypted token stored in the config, then
   * posts the generated comment body to the configured repository/issue.
   *
   * @returns {Promise<{ok: true} | {skipped: true, reason: string}>} Result object.
   */
  async function submitToGitHubIfEnabled() {
    var key = 'Dummy Key for Testing';
    const cfg = siteConfig.github;
    if (!cfg?.enabled) return { skipped: true, reason: 'disabled' };

    const owner = cfg.owner;
    const repo = cfg.repo;
    const issueNumber = cfg.issueNumber;

    /*
    To encrypt a token for testing, you can use the following code snippet in the browser console. 
    Make sure to replace 'YourTokenHere' with the actual token you want to encrypt, and use the same key as in the code above.

    const plainTextToken = '';
    const ciphertext = CryptoJS.AES.encrypt(plainTextToken, key).toString();
    console.log('Encrypted:', ciphertext);
    */
    const bytes = CryptoJS.AES.decrypt(cfg.token, key);
    const token = bytes.toString(CryptoJS.enc.Utf8);

    if (!owner || !repo || !issueNumber || !token) {
      return { skipped: true, reason: 'not_configured' };
    }

    const apiBase = (cfg.apiBase).replace(/\/$/, '');
    const url = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${Number(issueNumber)}/comments`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ body: buildCommentBody() })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { skipped: true, reason: `GitHub submit failed: HTTP ${res.status} ${text}` };
    }

    return { ok: true };
  }

  function showFinalScreen() {
    const vars = {
      toName: siteConfig.personal?.toName,
    };
    const titleEl = $('final-title');
    const bodyEl = $('final-body');

    titleEl.textContent = formatTemplate(siteConfig.personal?.finalThanksTitle, vars);
    bodyEl.textContent = formatTemplate(siteConfig.personal?.finalThanksBody, vars);
    setScreen('screen-final');
  }

  async function startCountdownAndMaybeSubmit() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;

    let remaining = 5;
    const tick = () => {
      if (countdownEl) {
        countdownEl.textContent = `Continuing in ${remaining}s…`;
      }
      remaining -= 1;
      if (remaining < 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        showFinalScreen();
      }
    };

    tick();
    countdownTimer = setInterval(tick, 1000);

    if (inFlight) return;
    inFlight = true;
    try {
      const result = await submitToGitHubIfEnabled();
      if (result?.ok) {
        status.textContent = '';
      } else {
        // If GitHub is disabled/not configured, keep it quiet.
        status.textContent = '';
      }
    } catch (e) {
      console.error(e);
      status.textContent = '';
    } finally {
      inFlight = false;
    }
  }

  return {
    startCountdownAndMaybeSubmit
  };
}

/**
 * Bootstraps the app.
 *
 * Loads the config, initializes UI/animations/audio, and wires up the
 * question/choice flows. It also sets up the auto-submit review flow.
 */
async function boot() {
  await loadConfig();

  const fromName = siteConfig.personal?.fromName;
  const toName = siteConfig.personal?.toName;
  const footerText = `This webpage is made by ${fromName} for ${toName}.`;
  const footerEl = $('footer-text');
  if (footerEl) footerEl.textContent = footerText;

  initStarfield();
  initAudio();
  setScreen('screen-welcome');
  initWelcomeScreen();
  initQuestionScreen();
  const review = initAutoReviewAndSubmit();

  // Expose on state so the choices flow can start the countdown
  state.review = review;
}

boot().catch((e) => {
  const toName = siteConfig.personal?.toName;
  console.error(e);
  setScreen('screen-welcome');
  const titleEl = $('welcome-title');
  const subtitleEl = $('welcome-subtitle');
  if (titleEl) titleEl.textContent = `Sorry ${toName}, something went wrong 😅`;
  if (subtitleEl) subtitleEl.textContent = 'Please refresh and try again.';
});
