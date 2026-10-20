(function () {
  const LEVEL_TIME_SECONDS = 60;   // Condition 1: time window for the word-count target
  const MIN_CORRECT_WORDS = 15;    // Condition 1: correct answers needed within that window
  const ACCURACY_THRESHOLD = 0.85; // Condition 2: minimum accuracy across the whole round
  const STAR_THRESHOLDS = [        // checked high-to-low; first match wins
    { min: 1.00, stars: 3 },
    { min: 0.90, stars: 2 },
    { min: 0.85, stars: 1 },
  ];
  const TIERS = ['Very-common', 'Common', 'Not-common', 'Rare'];

  const views = {
    home: document.getElementById('view-home'),
    game: document.getElementById('view-game'),
    result: document.getElementById('view-result'),
  };

  function showView(name) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
  }

  // --- group words by complexity tier ---
  const tierWords = {};
  TIERS.forEach(t => { tierWords[t] = []; });
  WORD_DATA.forEach(w => {
    if (tierWords[w.complexity]) tierWords[w.complexity].push(w);
  });

  // No level selection: the game always starts at the first tier and the
  // player moves up only by passing a level.
  document.getElementById('btn-play').addEventListener('click', () => startLevel(TIERS[0]));
  document.getElementById('btn-home').addEventListener('click', () => showView('home'));
  document.getElementById('btn-replay').addEventListener('click', () => startLevel(state.tier));
  document.getElementById('btn-next-level').addEventListener('click', () => {
    const nextTier = TIERS[TIERS.indexOf(state.tier) + 1];
    if (nextTier) startLevel(nextTier);
  });

  // --- game state ---
  let state = null;
  let timerInterval = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // The round is open-ended (it runs until the clock expires, not after a
  // fixed word count), so words are drawn from a shuffled queue that gets
  // reshuffled and extended whenever it runs dry, letting a fast player
  // cycle through a tier's pool more than once in one round.
  function nextWord() {
    if (state.queue.length === 0) {
      let fresh = shuffle(tierWords[state.tier]);
      if (state.lastWord && fresh.length > 1 && fresh[0] === state.lastWord) {
        [fresh[0], fresh[1]] = [fresh[1], fresh[0]];
      }
      state.queue = fresh;
    }
    const word = state.queue.shift();
    state.lastWord = word;
    return word;
  }

  function startLevel(tier) {
    state = {
      tier,
      queue: shuffle(tierWords[tier]),
      lastWord: null,
      current: null,
      correct: 0,
      answeredTotal: 0,
      timeLeft: LEVEL_TIME_SECONDS,
      answered: false,
      ended: false,
    };
    showView('game');
    updateLiveHud();
    startRoundClock();
    renderRound();
  }

  const cardWordEl = document.getElementById('card-word');
  const cardRevealEl = document.getElementById('card-reveal');
  const cardImageEl = document.getElementById('card-image');
  const cardEnglishEl = document.getElementById('card-english');
  const cardEl = document.getElementById('card');
  const hudWords = document.getElementById('hud-words');
  const hudScorePct = document.getElementById('hud-score-pct');
  const clockEl = document.getElementById('clock');
  const hudTimer = document.getElementById('hud-timer');
  const feedbackEl = document.getElementById('feedback');
  const btnTrue = document.getElementById('btn-true');
  const btnFalse = document.getElementById('btn-false');
  const mascotMouthEl = document.getElementById('mascot-mouth');
  const paceIconEl = document.getElementById('pace-icon');

  // Pronunciation playback: one shared Audio element, source swapped per round.
  const roundAudio = new Audio();
  roundAudio.crossOrigin = 'anonymous';

  // Web Audio API amplitude analysis, used to drive the mascot's mouth
  // openness from the real volume of the pronunciation clip as it plays.
  let audioCtx = null;
  let analyser = null;
  let amplitudeData = null;
  let mouthRAF = null;

  function ensureAudioGraph() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaElementSource(roundAudio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    amplitudeData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(audioCtx.destination); // keep audio audible
  }

  function setMouthScale(scale) {
    mascotMouthEl.style.transform = `translate(-50%, -50%) rotate(15deg) scaleY(${scale})`;
  }

  function animateMouth() {
    analyser.getByteTimeDomainData(amplitudeData);
    let sumSquares = 0;
    for (let i = 0; i < amplitudeData.length; i++) {
      const centered = (amplitudeData[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / amplitudeData.length);
    const scale = 0.15 + Math.min(rms * 6, 1) * 1.1; // 0.15 (closed) .. ~1.25 (wide open)
    setMouthScale(scale);
    mouthRAF = requestAnimationFrame(animateMouth);
  }

  function stopMouthAnimation() {
    if (mouthRAF) cancelAnimationFrame(mouthRAF);
    mouthRAF = null;
    setMouthScale(0.15);
  }

  roundAudio.addEventListener('ended', stopMouthAnimation);
  roundAudio.addEventListener('pause', stopMouthAnimation);

  const mascotEl = document.getElementById('mascot');
  mascotEl.addEventListener('click', () => {
    if (state && state.current && state.current.word.audio) playRoundAudio();
  });
  mascotEl.style.cursor = 'pointer';

  function playRoundAudio() {
    ensureAudioGraph();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    roundAudio.currentTime = 0;
    roundAudio.play().then(() => {
      if (!mouthRAF) animateMouth();
    }).catch(() => {}); // ignore autoplay/decoding errors
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Repurposed HUD badges live-track the two pass conditions: WORDS shows
  // progress toward the "correct within time" target, SCORE shows running
  // accuracy. The pace icon below the card mirrors condition 1 as a tick/cross.
  function updateLiveHud() {
    hudWords.innerHTML = `${state.correct}<small>/${MIN_CORRECT_WORDS}</small>`;
    const pct = state.answeredTotal > 0 ? Math.round((state.correct / state.answeredTotal) * 100) : 0;
    hudScorePct.innerHTML = `${pct}<small>%</small>`;

    const paceMet = state.correct >= MIN_CORRECT_WORDS;
    paceIconEl.textContent = paceMet ? '✔' : '✘';
    paceIconEl.classList.toggle('met', paceMet);
  }

  function startRoundClock() {
    clearInterval(timerInterval);
    updateClockDisplay();
    timerInterval = setInterval(() => {
      state.timeLeft -= 1;
      updateClockDisplay();
      if (state.timeLeft <= 0) {
        clearInterval(timerInterval);
        endLevel();
      }
    }, 1000);
  }

  function updateClockDisplay() {
    hudTimer.textContent = pad(Math.max(state.timeLeft, 0));
    clockEl.classList.toggle('urgent', state.timeLeft > 0 && state.timeLeft <= 10);
  }

  function renderRound() {
    const word = nextWord();
    state.current = { word, isTrue: word.hasBlood };
    state.answered = false;
    cardRevealEl.classList.add('hidden');
    cardEl.classList.remove('revealed');
    btnTrue.classList.remove('selected');
    btnFalse.classList.remove('selected');
    cardWordEl.textContent = word.yoruba;
    cardImageEl.alt = word.english;
    cardImageEl.src = word.image;
    cardEnglishEl.textContent = word.english;

    roundAudio.pause();
    stopMouthAnimation();
    if (word.audio) {
      roundAudio.src = word.audio;
      playRoundAudio(); // plays automatically alongside the Yoruba word; mascot's mouth animates with it
    }
    feedbackEl.classList.add('hidden');
    btnTrue.disabled = false;
    btnFalse.disabled = false;
  }

  function revealCard() {
    cardRevealEl.classList.remove('hidden');
    cardEl.classList.add('revealed');
  }

  cardEl.addEventListener('click', () => {
    if (cardRevealEl.classList.contains('hidden')) revealCard();
  });

  function answer(playerSaysTrue) {
    if (state.answered || state.ended) return;
    state.answered = true;
    revealCard();
    btnTrue.disabled = true;
    btnFalse.disabled = true;

    const isCorrect = playerSaysTrue === state.current.isTrue;
    state.answeredTotal += 1;
    if (isCorrect) state.correct += 1;
    if (playerSaysTrue === true) btnTrue.classList.add('selected');
    if (playerSaysTrue === false) btnFalse.classList.add('selected');
    updateLiveHud();

    feedbackEl.textContent = isCorrect ? '✔' : '✘';
    feedbackEl.className = 'feedback ' + (isCorrect ? 'correct' : 'wrong');

    setTimeout(() => {
      if (state.ended) return; // the round clock ran out during the feedback pause
      renderRound();
    }, 900);
  }

  btnTrue.addEventListener('click', () => answer(true));
  btnFalse.addEventListener('click', () => answer(false));

  // The round clock can expire while a word is on screen but unanswered;
  // that word is discarded (not counted) rather than scored either way.
  function endLevel() {
    if (state.ended) return;
    state.ended = true;
    clearInterval(timerInterval);
    roundAudio.pause();
    stopMouthAnimation();
    btnTrue.disabled = true;
    btnFalse.disabled = true;
    if (!state.answered && state.current) revealCard();
    finishLevel();
  }

  function starsForAccuracy(accuracy) {
    for (const tier of STAR_THRESHOLDS) {
      if (accuracy >= tier.min) return tier.stars;
    }
    return 0;
  }

  const resultTitleEl = document.getElementById('result-title');
  const resultPctEl = document.getElementById('result-pct');
  const resultSubEl = document.getElementById('result-sub');
  const resultStarsEl = document.getElementById('result-stars');
  const condWordsEl = document.getElementById('cond-words');
  const condAccuracyEl = document.getElementById('cond-accuracy');
  const resultNextQuestionEl = document.getElementById('result-next-question');
  const btnNextLevel = document.getElementById('btn-next-level');

  function setConditionRow(el, met, label) {
    el.classList.toggle('met', met);
    el.classList.toggle('unmet', !met);
    el.querySelector('.condition-icon').textContent = met ? '✔' : '✘';
    el.querySelector('.condition-label').textContent = label;
  }

  function finishLevel() {
    const total = state.answeredTotal;
    const accuracy = total > 0 ? state.correct / total : 0;
    const pct = Math.round(accuracy * 100);
    const cond1 = state.correct >= MIN_CORRECT_WORDS;
    const cond2 = accuracy >= ACCURACY_THRESHOLD;
    const passed = cond1 && cond2;
    const stars = passed ? starsForAccuracy(accuracy) : 0;
    const nextTier = TIERS[TIERS.indexOf(state.tier) + 1];

    resultSubEl.textContent = state.tier;
    resultPctEl.textContent = pct + '%';
    views.result.classList.toggle('fail', !passed);

    setConditionRow(condWordsEl, cond1, `${state.correct}/${MIN_CORRECT_WORDS} words in ${LEVEL_TIME_SECONDS}s`);
    setConditionRow(condAccuracyEl, cond2, `${pct}% accuracy (need ${Math.round(ACCURACY_THRESHOLD * 100)}%)`);

    resultStarsEl.classList.toggle('hidden', !passed);
    resultStarsEl.querySelectorAll('.star').forEach((starEl, i) => {
      starEl.classList.toggle('filled', i < stars);
    });

    if (passed && nextTier) {
      resultTitleEl.textContent = 'Congratulations!';
      resultNextQuestionEl.textContent = `Move to the next level: ${nextTier}?`;
      resultNextQuestionEl.classList.remove('hidden');
      btnNextLevel.classList.remove('hidden');
      btnNextLevel.textContent = `Yes, Next Level ▸`;
    } else if (passed && !nextTier) {
      resultTitleEl.textContent = 'All Levels Mastered!';
      resultNextQuestionEl.classList.add('hidden');
      btnNextLevel.classList.add('hidden');
    } else {
      resultTitleEl.textContent = 'You Failed!';
      resultNextQuestionEl.classList.add('hidden');
      btnNextLevel.classList.add('hidden');
    }

    showView('result');
  }
})();
