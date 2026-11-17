const dialog = document.querySelector('[data-image-viewer]');
if (dialog instanceof HTMLDialogElement) {
  const content = dialog.querySelector('[data-viewer-content]');
  const closeButton = dialog.querySelector('[data-viewer-close]');
  const zoomToolbar = dialog.querySelector('[data-viewer-zoom]');
  const zoomRange = dialog.querySelector('[data-viewer-zoom-range]');
  const zoomValue = dialog.querySelector('[data-viewer-zoom-value]');
  let returnFocus = null;

  function applyZoom() {
    const scale = Number(zoomRange.value) / 100;
    const pair = dialog.classList.contains('image-viewer-pair');
    const availableWidth = Math.max(1, content.clientWidth / (pair ? 2 : 1) - 16);
    for (const image of content.querySelectorAll('img')) {
      const baseWidth = Math.min(image.naturalWidth || availableWidth, availableWidth);
      const width = Math.round(baseWidth * scale);
      image.style.width = `${width}px`;
      image.style.maxWidth = 'none';
      image.style.maxHeight = 'none';
      image.closest('figure').style.width = `${width}px`;
    }
    zoomValue.value = `${zoomRange.value}%`;
    zoomValue.textContent = `${zoomRange.value}%`;
  }

  function addFigure({ src, alt, caption, label }) {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    image.decoding = 'async';
    image.loading = 'eager';
    figure.append(image);
    if (caption || label) {
      const figcaption = document.createElement('figcaption');
      if (label) {
        const strong = document.createElement('strong');
        strong.textContent = label;
        figcaption.append(strong);
      }
      if (label && caption) figcaption.append(document.createTextNode(' — '));
      if (caption) figcaption.append(document.createTextNode(caption));
      figure.append(figcaption);
    }
    content.append(figure);
    return image;
  }

  document.addEventListener('click', async event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-image-viewer-open]') : null;
    if (!trigger || !dialog.showModal) return;
    event.preventDefault();
    returnFocus = trigger;
    content.replaceChildren();
    const images = [];
    if (trigger.dataset.viewerBefore && trigger.dataset.viewerAfter) {
      images.push(addFigure({
        src: trigger.dataset.viewerBefore,
        alt: trigger.dataset.viewerBeforeAlt,
        caption: trigger.dataset.viewerBeforeCaption,
        label: trigger.dataset.viewerLabelA,
      }));
      images.push(addFigure({
        src: trigger.dataset.viewerAfter,
        alt: trigger.dataset.viewerAfterAlt,
        caption: trigger.dataset.viewerAfterCaption,
        label: trigger.dataset.viewerLabelB,
      }));
      dialog.classList.add('image-viewer-pair');
    } else {
      images.push(addFigure({
        src: trigger.dataset.viewerImage || trigger.href,
        alt: trigger.dataset.viewerAlt || '',
        caption: trigger.dataset.viewerCaption || '',
      }));
      dialog.classList.remove('image-viewer-pair');
    }
    const zoomable = trigger.dataset.viewerZoomable === 'true';
    dialog.classList.toggle('image-viewer-zoomable', zoomable);
    zoomToolbar.hidden = !zoomable;
    zoomRange.value = '100';
    dialog.showModal();
    closeButton.focus();
    await Promise.all(images.map(image => image.decode().catch(() => undefined)));
    if (zoomable) applyZoom();
  });

  zoomRange.addEventListener('input', applyZoom);
  dialog.querySelectorAll('[data-viewer-zoom-step]').forEach(button => {
    button.addEventListener('click', () => {
      zoomRange.value = String(Math.max(Number(zoomRange.min), Math.min(Number(zoomRange.max), Number(zoomRange.value) + Number(button.dataset.viewerZoomStep))));
      applyZoom();
    });
  });
  dialog.querySelector('[data-viewer-zoom-reset]').addEventListener('click', () => {
    zoomRange.value = '100';
    applyZoom();
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    zoomToolbar.hidden = true;
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  });
}
