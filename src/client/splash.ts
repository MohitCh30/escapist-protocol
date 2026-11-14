import { context, requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button') as HTMLButtonElement;
const titleElement = document.getElementById('title') as HTMLHeadingElement;
const descElement = document.getElementById('description') as HTMLParagraphElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

function init() {
  titleElement.textContent = 'ESCAPE PROTOCOL';
  descElement.textContent =
    context.username
      ? `DAILY LOCKDOWN — the academy is locked down today, ${context.username}.`
      : 'DAILY LOCKDOWN — every choice determines their fate.';
}

init();
