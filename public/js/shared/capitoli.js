// Video playlist: one short clip per topic, played one after the other like a single video.
// The list (and the segment strip under the player) loads a clip; #<slug> links open one clip
(function () {
  const video = document.querySelector('.player video');
  const strip = document.querySelector('.player .marcatori');
  const list = document.querySelector('.capitoli');
  const links = [...list.querySelectorAll('a[data-src]')];
  const v = list.dataset.v;
  let current = -1;

  const segments = links.map((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = a.querySelector('.nome').textContent;
    b.setAttribute('aria-label', b.title);
    b.style.flexGrow = a.dataset.d;
    b.onclick = () => load(i, true);
    strip.appendChild(b);
    return b;
  });

  function load(i, play) {
    if (i !== current) {
      current = i;
      video.poster = links[i].dataset.src.replace(/\.mp4$/, '.jpg') + '?v=' + v;
      video.src = links[i].dataset.src + '?v=' + v;
      links.forEach((a, k) => a.classList.toggle('on', k === i));
      segments.forEach((b, k) => b.classList.toggle('on', k === i));
    }
    if (play) video.play().catch(() => {});
  }

  // Shared link (#scontrini): show that clip; playing needs a tap (browsers block autoplay with sound)
  function fromHash() {
    const i = links.findIndex(a => a.getAttribute('href') === location.hash);
    load(Math.max(i, 0), false);
  }

  links.forEach((a, i) => a.addEventListener('click', e => {
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    load(i, true);
  }));
  video.addEventListener('ended', () => { if (current + 1 < links.length) load(current + 1, true); });
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
