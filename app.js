const state = {
  videos: [],
  deck: [],
  current: null,
  player: null,
  playerReady: false,
  started: false,
  lastVideoId: null,
};

const els = {
  startOverlay: document.querySelector('#startOverlay'),
  startButton: document.querySelector('#startButton'),
  startMessage: document.querySelector('#startMessage'),
  nextButton: document.querySelector('#nextButton'),
  postLink: document.querySelector('#postLink'),
  trackTitle: document.querySelector('#trackTitle'),
  libraryCount: document.querySelector('#libraryCount'),
  loading: document.querySelector('#loading'),
  toast: document.querySelector('#toast'),
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function refillDeck() {
  state.deck = shuffle(state.videos);

  // Avoid an immediate repeat at the boundary between shuffled rounds.
  if (state.deck.length > 1 && state.deck[0].youtubeId === state.lastVideoId) {
    [state.deck[0], state.deck[1]] = [state.deck[1], state.deck[0]];
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function setCurrentVideo(video) {
  state.current = video;
  state.lastVideoId = video.youtubeId;
  els.trackTitle.textContent = video.summary || 'YouTube video';

  if (video.postUrl) {
    els.postLink.href = video.postUrl;
    els.postLink.classList.remove('disabled');
  } else {
    els.postLink.classList.add('disabled');
  }
}

function playNext() {
  if (!state.playerReady || !state.started || !state.videos.length) return;
  if (!state.deck.length) refillDeck();

  const next = state.deck.shift();
  setCurrentVideo(next);
  els.loading.classList.add('hidden');
  state.player.loadVideoById(next.youtubeId);
}

function handlePlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    playNext();
  }

  if (event.data === YT.PlayerState.PLAYING) {
    const data = state.player.getVideoData?.();
    if (data?.title) els.trackTitle.textContent = data.title;
  }
}

function handlePlayerError() {
  showToast('Skipping an unavailable video…');
  setTimeout(playNext, 350);
}

function handleAutoplayBlocked() {
  showToast('Your browser paused autoplay. Tap the video to continue.');
}

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  state.player = new YT.Player('player', {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        state.playerReady = true;
        if (state.started) playNext();
      },
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError,
      onAutoplayBlocked: handleAutoplayBlocked,
    },
  });
};

async function loadLibrary() {
  try {
    const response = await fetch('/api/videos', { headers: { Accept: 'application/json' } });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || `Archive request failed (${response.status})`);
    }

    state.videos = payload.videos || [];
    if (!state.videos.length) throw new Error('No YouTube videos were found in the Tumblr archive.');

    refillDeck();
    els.libraryCount.textContent = `${state.videos.length.toLocaleString()} videos`;
    els.startMessage.textContent = `${state.videos.length.toLocaleString()} videos ready. The deck reshuffles after every full run.`;
    els.startButton.disabled = false;
    els.nextButton.disabled = false;
  } catch (error) {
    console.error(error);
    els.startMessage.textContent = error.message;
    els.startButton.textContent = 'Could not load archive';
    els.trackTitle.textContent = 'Archive unavailable';
  }
}

els.startButton.addEventListener('click', () => {
  if (!state.videos.length) return;
  state.started = true;
  els.startOverlay.classList.add('hidden');
  playNext();
});

els.nextButton.addEventListener('click', playNext);

loadLibrary();
