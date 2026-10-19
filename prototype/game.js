(function () {
  const QUESTION_SECONDS = 8;
  const PASS_THRESHOLD = 0.8;
  const WORDS_PER_ROUND = 12;
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

  // Pick WORDS_PER_ROUND words from a tier with a roughly even hasBlood yes/no
  // split (adjusted when a tier is short on one side) and natural category
  // spread (each tier covers 10+ categories, so a random draw mixes them).
  function pickRoundWords(tier) {
    const pool = tierWords[tier];
    const target = Math.min(WORDS_PER_ROUND, pool.length);
    const yes = shuffle(pool.filter(w => w.hasBlood));
    const no = shuffle(pool.filter(w => !w.hasBlood));
    const half = Math.ceil(target / 2);

    let takeYes = Math.min(half, yes.length);
    let takeNo = Math.min(target - takeYes, no.length);
    if (takeYes + takeNo < target) {
      takeYes = Math.min(target - takeNo, yes.length);
    }

    return shuffle(yes.slice(0, takeYes).concat(no.slice(0, takeNo)));
  }

  // Every round shows one word: its Yoruba name, English name and picture always
  // come from the same WORD_DATA entry, so they can never be mismatched. The
  // question is whether that thing has blood ("Léje léje") or not ("Iró nlá").
  function buildRounds(tier) {
    return pickRoundWords(tier).map(word => ({ word, isTrue: word.hasBlood }));
  }

  function startLevel(tier) {
    state = {
      tier,
      rounds: buildRounds(tier),
      index: 0,
      correct: 0,
      wrong: 0,
      answered: false,
    };
    showView('game');
    renderRound();
  }

  const cardWordEl = document.getElementById('card-word');
  const cardRevealEl = document.getElementById('card-reveal');
  const cardImageEl = document.getElementById('card-image');
  const cardEnglishEl = document.getElementById('card-english');
  const cardEl = document.getElementById('card');
  const hudWords = document.getElementById('hud-words');
  const hudScore = document.getElementById('hud-score');
  const hudWrong = document.getElementById('hud-wrong');
  const clockEl = document.getElementById('clock');
  const hudTimer = document.getElementById('hud-timer');
  const feedbackEl = document.getElementById('feedback');
  const btnTrue = document.getElementById('btn-true');
  const btnFalse = document.getElementById('btn-false');
  const mascotMouthEl = document.getElementById('mascot-mouth');

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
    if (state && state.rounds[state.index].word.audio) playRoundAudio();
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

  function renderRound() {
    const round = state.rounds[state.index];
    state.answered = false;
    cardRevealEl.classList.add('hidden');
    cardEl.classList.remove('revealed');
    btnTrue.classList.remove('selected');
    btnFalse.classList.remove('selected');
    clockEl.classList.remove('urgent');
    cardWordEl.textContent = round.word.yoruba;
    cardImageEl.alt = round.word.english;
    cardImageEl.src = round.word.image;
    cardEnglishEl.textContent = round.word.english;

    roundAudio.pause();
    stopMouthAnimation();
    if (round.word.audio) {
      roundAudio.src = round.word.audio;
      playRoundAudio(); // plays automatically alongside the Yoruba word; mascot's mouth animates with it
    }
    feedbackEl.classList.add('hidden');
    btnTrue.disabled = false;
    btnFalse.disabled = false;

    hudWords.innerHTML = `${state.index + 1}<small>/${pad(state.rounds.length)}</small>`;
    hudScore.textContent = pad(state.correct);
    hudWrong.textContent = pad(state.wrong);

    let timeLeft = QUESTION_SECONDS;
    hudTimer.textContent = pad(timeLeft);
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft -= 1;
      hudTimer.textContent = pad(Math.max(timeLeft, 0));
      clockEl.classList.toggle('urgent', timeLeft <= 3);
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (!state.answered) answer(null);
      }
    }, 1000);
  }

  function revealCard() {
    cardRevealEl.classList.remove('hidden');
    cardEl.classList.add('revealed');
  }

  cardEl.addEventListener('click', () => {
    if (cardRevealEl.classList.contains('hidden')) revealCard();
  });

  function answer(playerSaysTrue) {
    if (state.answered) return;
    state.answered = true;
    clearInterval(timerInterval);
    revealCard();
    btnTrue.disabled = true;
    btnFalse.disabled = true;

    const round = state.rounds[state.index];
    const isCorrect = playerSaysTrue === round.isTrue;
    if (isCorrect) state.correct += 1; else state.wrong += 1;
    if (playerSaysTrue === true) btnTrue.classList.add('selected');
    if (playerSaysTrue === false) btnFalse.classList.add('selected');
    hudScore.textContent = pad(state.correct);
    hudWrong.textContent = pad(state.wrong);

    feedbackEl.textContent = isCorrect ? '✔' : '✘';
    feedbackEl.className = 'feedback ' + (isCorrect ? 'correct' : 'wrong');

    setTimeout(() => {
      state.index += 1;
      if (state.index >= state.rounds.length) {
        finishLevel();
      } else {
        renderRound();
      }
    }, 900);
  }

  btnTrue.addEventListener('click', () => answer(true));
  btnFalse.addEventListener('click', () => answer(false));

  const resultTitleEl = document.getElementById('result-title');
  const resultPctEl = document.getElementById('result-pct');
  const resultSubEl = document.getElementById('result-sub');
  const resultNextQuestionEl = document.getElementById('result-next-question');
  const btnNextLevel = document.getElementById('btn-next-level');

  function finishLevel() {
    const total = state.rounds.length;
    const pct = Math.round((state.correct / total) * 100);
    const passed = (state.correct / total) >= PASS_THRESHOLD;
    const nextTier = TIERS[TIERS.indexOf(state.tier) + 1];

    resultSubEl.textContent = `Score: ${state.correct}/${total} — ${state.tier}`;
    resultPctEl.textContent = pct + '%';
    views.result.classList.toggle('fail', !passed);

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
