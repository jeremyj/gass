// Video chapters: a marker strip under the video and a list of links (#t=m:ss, shareable)
// that jump to each part; the current chapter is highlighted in both while the video plays
(function () {
  const video = document.querySelector('.player video');
  const strip = document.querySelector('.player .marcatori');
  const links = [...document.querySelectorAll('.capitoli a[data-t]')];
  const starts = links.map(a => Number(a.dataset.t));
  let segments = [];

  const parseT = s => s.includes(':') ? s.split(':').reduce((acc, x) => acc * 60 + Number(x), 0) : Number(s);
  const seek = (t, play) => {
    video.currentTime = t;
    video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (play) video.play().catch(() => {});
  };

  function drawStrip() {
    if (segments.length || !video.duration) return;
    segments = starts.map((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = links[i].querySelector('.nome').textContent;
      b.setAttribute('aria-label', b.title);
      b.style.flexGrow = (starts[i + 1] ?? video.duration) - t;
      b.onclick = () => seek(t, true);
      strip.appendChild(b);
      return b;
    });
    highlight();
  }

  function highlight() {
    const now = video.currentTime;
    const i = starts.reduce((cur, t, k) => (now >= t - 0.25 ? k : cur), 0);
    links.forEach((a, k) => a.classList.toggle('on', k === i));
    segments.forEach((b, k) => b.classList.toggle('on', k === i));
  }

  // Shared link (#t=1:33): position the video there; playing needs a tap (browsers block autoplay with sound)
  function fromHash() {
    const m = location.hash.match(/^#t=([\d:.]+)$/);
    if (!m) return;
    const t = parseT(m[1]);
    if (video.readyState >= 1) seek(t, false);
    else video.addEventListener('loadedmetadata', () => seek(t, false), { once: true });
  }

  links.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    seek(Number(a.dataset.t), true);
  }));
  video.addEventListener('loadedmetadata', drawStrip);
  video.addEventListener('timeupdate', highlight);
  video.addEventListener('seeked', highlight);
  window.addEventListener('hashchange', fromHash);
  drawStrip();
  fromHash();
})();
