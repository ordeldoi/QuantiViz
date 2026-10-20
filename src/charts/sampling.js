import * as d3 from 'd3';

// Fiktives Beispiel: 1 Punkt = 1 Person
const COLS = 25;
const ROWS = 20;
const MEMBER_COLS = 10;
const MEMBER_ROWS = 16; // 10 × 16 = 160 Mitglieder
const RESPONDENTS = 120;
// Anzahl Personen pro Gruppe, die ein stärkeres politisches Engagement befürworten
const PRO = { nonMember: 129, respondent: 96, nonRespondent: 18 };

// Layout
const SPACING = 18;
const GAP = 18;
const RADIUS = 5.5;
const FRAME_PAD = 10;
const margin = { top: 30, right: 14, bottom: 14, left: 14 };
const width = margin.left + 2 * FRAME_PAD + COLS * SPACING + GAP + margin.right;
const height = margin.top + 2 * FRAME_PAD + ROWS * SPACING + GAP + margin.bottom;

const px = (col) =>
  margin.left + FRAME_PAD + col * SPACING + (col >= MEMBER_COLS ? GAP : 0) + SPACING / 2;
const py = (row) =>
  margin.top + FRAME_PAD + row * SPACING + (row >= MEMBER_ROWS ? GAP : 0) + SPACING / 2;

const pct = new Intl.NumberFormat('de-CH', { style: 'percent', maximumFractionDigits: 0 });

const GROUPS = [
  { label: 'Grundgesamtheit', step: 0, filter: () => true },
  { label: 'Auswahlgesamtheit', step: 1, filter: (p) => p.member },
  { label: 'Geplante Stichprobe', step: 2, filter: (p) => p.member },
  { label: 'Effektive Stichprobe', step: 3, filter: (p) => p.respondent },
];

const STEPS = [
  {
    title: 'Grundgesamtheit',
    text: () =>
      'Alle Personen, über die die Studie eine Aussage machen will: <strong>alle Fachkräfte der ' +
      'Sozialen Arbeit in der Schweiz</strong>. Im fiktiven Beispiel sind das 500 Personen.',
    dot: () => 'in',
    legend: [['in', 'Fachkraft der Sozialen Arbeit']],
    frame: null,
  },
  {
    title: 'Auswahlgesamtheit',
    text: () =>
      'Alle Personen, die überhaupt in die Stichprobe gelangen können. Der Link wird nur an die ' +
      '<strong>Mitglieder von AvenirSocial</strong> verschickt: 160 von 500. Wer nicht Mitglied ' +
      'ist, hat keine Chance, befragt zu werden. Verbandsmitglieder dürften zudem politisch ' +
      'engagierter sein als andere Fachkräfte.',
    dot: (p) => (p.member ? 'in' : 'out'),
    legend: [
      ['in', 'Mitglied, erreichbar'],
      ['out', 'nicht Mitglied, nicht erreichbar'],
    ],
    frame: 'Auswahlgesamtheit · 160',
  },
  {
    title: 'Geplante Stichprobe',
    text: () =>
      'Die Personen, die zur Befragung eingeladen werden. Hier sind es <strong>alle 160 ' +
      'Mitglieder</strong>. Die geplante Stichprobe ist also gleich gross wie die ' +
      'Auswahlgesamtheit. Eine Zufallsauswahl aus der Grundgesamtheit findet nicht statt.',
    dot: (p) => (p.member ? 'in' : 'out'),
    legend: [
      ['in', 'eingeladen'],
      ['out', 'nicht eingeladen'],
    ],
    frame: 'Geplante Stichprobe = Auswahlgesamtheit · 160',
  },
  {
    title: 'Effektive Stichprobe',
    text: () =>
      'Die Personen, die tatsächlich teilnehmen: <strong>120 von 160</strong> Eingeladenen ' +
      '(Rücklauf 75%). Ob jemand mitmacht, entscheidet die Person selbst. Wer sich für Politik ' +
      'interessiert, füllt eine Umfrage zu politischem Engagement eher aus.',
    dot: (p) => (p.respondent ? 'in' : p.member ? 'invited' : 'out'),
    legend: [
      ['in', 'hat teilgenommen'],
      ['invited', 'eingeladen, nicht teilgenommen'],
      ['out', 'nicht eingeladen'],
    ],
    frame: 'Eingeladen · 160, davon 120 teilgenommen',
  },
  {
    title: 'Schlussfolgerung',
    text: (shares) =>
      `Angenommen, wir kennen die Haltung aller 500 Personen. In der effektiven Stichprobe ` +
      `befürworten <strong>${pct.format(shares[3])}</strong> ein stärkeres politisches ` +
      `Engagement, in der Grundgesamtheit aber nur <strong>${pct.format(shares[0])}</strong>. ` +
      `Die Aussage «Die Soziale Arbeit soll sich deutlich stärker einmischen» gilt deshalb für ` +
      `die Befragten, nicht für alle Fachkräfte der Sozialen Arbeit.`,
    dot: (p) => (p.pro ? 'pro' : 'contra'),
    legend: [
      ['pro', 'befürwortet stärkeres Engagement'],
      ['contra', 'befürwortet es nicht'],
    ],
    frame: 'Mitglieder · 160',
  },
];

function createPeople() {
  const shuffle = d3.shuffler(d3.randomLcg(7));
  const people = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const member = col < MEMBER_COLS && row < MEMBER_ROWS;
      people.push({ id: people.length + 1, row, col, member, respondent: false, pro: false });
    }
  }
  shuffle(people.filter((p) => p.member)).forEach((p, i) => {
    p.respondent = i < RESPONDENTS;
  });
  const assignPro = (group, count) =>
    shuffle(group).forEach((p, i) => {
      p.pro = i < count;
    });
  assignPro(people.filter((p) => !p.member), PRO.nonMember);
  assignPro(people.filter((p) => p.respondent), PRO.respondent);
  assignPro(people.filter((p) => p.member && !p.respondent), PRO.nonRespondent);
  return people;
}

/**
 * Schrittweise Darstellung: Grundgesamtheit → Auswahlgesamtheit →
 * geplante Stichprobe → effektive Stichprobe → Schlussfolgerung.
 * @param {HTMLElement} root  Container mit den sp-*-IDs
 */
export function samplingDemo(root) {
  const el = (id) => root.querySelector(`#${id}`);
  const people = createPeople();
  const shares = GROUPS.map((g) => {
    const members = people.filter(g.filter);
    return members.filter((p) => p.pro).length / members.length;
  });
  let step = 0;

  const chart = el('sp-chart');
  const svg = d3
    .select(chart)
    .append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('role', 'img')
    .attr('aria-label', 'Punktdiagramm: 500 Personen der Grundgesamtheit');

  // Rahmen um Grundgesamtheit und Mitglieder
  svg
    .append('rect')
    .attr('class', 'frame outer')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom)
    .attr('rx', 6);
  svg
    .append('text')
    .attr('class', 'frame-label')
    .attr('x', margin.left)
    .attr('y', margin.top - 10)
    .text('Grundgesamtheit · 500');

  const inner = svg.append('g').attr('class', 'inner-frame');
  const innerBottom = py(MEMBER_ROWS - 1) + SPACING / 2 + 4;
  inner
    .append('rect')
    .attr('class', 'frame')
    .attr('x', px(0) - SPACING / 2 - 4)
    .attr('y', py(0) - SPACING / 2 - 4)
    .attr('width', MEMBER_COLS * SPACING + 8)
    .attr('height', MEMBER_ROWS * SPACING + 8)
    .attr('rx', 4);
  const innerLabel = inner
    .append('text')
    .attr('class', 'frame-label')
    .attr('x', px(0) - SPACING / 2 - 4)
    .attr('y', innerBottom + 13);

  const dots = svg
    .append('g')
    .selectAll('circle')
    .data(people)
    .join('circle')
    .attr('cx', (p) => px(p.col))
    .attr('cy', (p) => py(p.row))
    .attr('r', RADIUS);

  // Grössere, unsichtbare Trefferflächen für den Tooltip
  svg
    .append('g')
    .selectAll('circle')
    .data(people)
    .join('circle')
    .attr('class', 'hit-area')
    .attr('cx', (p) => px(p.col))
    .attr('cy', (p) => py(p.row))
    .attr('r', SPACING / 2)
    .on('pointerenter pointermove', showTooltip)
    .on('pointerleave', hideTooltip);

  const tooltip = d3.select(chart).append('div').attr('class', 'tooltip').attr('hidden', true);

  // Schritt-Navigation
  const stepButtons = d3
    .select(el('sp-steps'))
    .selectAll('li')
    .data(STEPS)
    .join('li')
    .append('button')
    .text((s, i) => `${i + 1}. ${s.title}`)
    .on('click', (event, s) => render(STEPS.indexOf(s)));
  el('sp-prev').addEventListener('click', () => render(step - 1));
  el('sp-next').addEventListener('click', () => render(step + 1));

  function showTooltip(event, p) {
    const lines = [`<strong>Person ${p.id}</strong>`];
    if (step >= 1) lines.push(`Mitglied AvenirSocial: ${p.member ? 'ja' : 'nein'}`);
    if (step >= 3 && p.member) lines.push(`Teilnahme: ${p.respondent ? 'ja' : 'nein'}`);
    if (step === 4) lines.push(`Haltung: ${p.pro ? 'befürwortet' : 'befürwortet nicht'}`);
    const [x, y] = d3.pointer(event, chart);
    tooltip
      .attr('hidden', null)
      .html(lines.join('<br>'))
      .style('left', `${x}px`)
      .style('top', `${y}px`);
  }

  function hideTooltip() {
    tooltip.attr('hidden', true);
  }

  function renderFunnel(attitude) {
    const rows = d3
      .select(el('sp-funnel'))
      .classed('attitude', attitude)
      .selectAll('.funnel-row')
      .data(GROUPS)
      .join((enter) => {
        const row = enter.append('div').attr('class', 'funnel-row');
        row.append('div').attr('class', 'funnel-label');
        row
          .append('div')
          .attr('class', 'funnel-track')
          .append('div')
          .attr('class', 'funnel-bar')
          .append('div')
          .attr('class', 'funnel-pro');
        return row;
      });

    rows.classed('current', (g) => g.step === step).classed('future', (g) => g.step > step);
    rows.select('.funnel-label').html((g, i) => {
      const count = people.filter(g.filter).length;
      const extra = attitude ? ` · ${pct.format(shares[i])} dafür` : '';
      return `<span>${g.label}</span><span>${count}${extra}</span>`;
    });
    rows
      .select('.funnel-bar')
      .style('width', (g) => `${(people.filter(g.filter).length / people.length) * 100}%`);
    rows.select('.funnel-pro').style('width', (g, i) => (attitude ? `${shares[i] * 100}%` : '0%'));
  }

  function render(index) {
    step = Math.max(0, Math.min(STEPS.length - 1, index));
    const current = STEPS[step];

    dots.attr('class', (p) => `person ${current.dot(p)}`);
    inner.classed('visible', current.frame !== null);
    innerLabel.text(current.frame ?? '');

    el('sp-title').textContent = current.title;
    el('sp-text').innerHTML = current.text(shares);
    el('sp-legend').innerHTML = current.legend
      .map(
        ([cls, label]) =>
          `<span><svg width="12" height="12" aria-hidden="true">` +
          `<circle class="person ${cls}" cx="6" cy="6" r="4.5"></circle></svg>${label}</span>`,
      )
      .join('');
    renderFunnel(step === STEPS.length - 1);

    stepButtons.attr('aria-current', (s, i) => (i === step ? 'step' : null));
    el('sp-prev').disabled = step === 0;
    el('sp-next').disabled = step === STEPS.length - 1;
    hideTooltip();
  }

  render(0);
}
