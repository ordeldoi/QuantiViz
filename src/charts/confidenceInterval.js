import * as d3 from 'd3';
import { tQuantile } from '../stats.js';

// Populationen, aus denen Stichproben gezogen werden
const DISTRIBUTIONS = {
  normal: {
    mean: 0,
    domain: [-4, 4],
    sample: d3.randomNormal(0, 1),
    pdf: (x) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI),
  },
  uniform: {
    mean: 0,
    domain: [-4, 4],
    sample: d3.randomUniform(-2, 2),
    pdf: (x) => (x >= -2 && x <= 2 ? 0.25 : 0),
  },
  exponential: {
    mean: 1,
    domain: [-1, 5],
    sample: d3.randomExponential(1),
    pdf: (x) => (x < 0 ? 0 : Math.exp(-x)),
  },
};

// Layout
const width = 720;
const margin = { top: 28, right: 16, bottom: 32, left: 16 };
const densityHeight = 80;
const sampleY = margin.top + densityHeight + 30;
const stackTop = sampleY + 30;
const rowHeight = 10;
const maxRows = 25;
const height = stackTop + maxRows * rowHeight + margin.bottom;
const tickMs = 800;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = reduceMotion ? 0 : 400;

const fmt = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('de-CH', { style: 'percent', maximumFractionDigits: 0 });

/**
 * Simulation von Konfidenzintervallen für den Mittelwert μ.
 * Inspiriert von Seeing Theory (Kunin et al.) und Kristoffer Magnusson.
 * @param {HTMLElement} root  Container mit den Bedienelementen (ci-*-IDs)
 */
export function confidenceIntervalDemo(root) {
  const el = (id) => root.querySelector(`#${id}`);
  const controls = {
    dist: el('ci-dist'),
    n: el('ci-n'),
    level: el('ci-level'),
    start: el('ci-start'),
    step: el('ci-step'),
    reset: el('ci-reset'),
  };

  const state = {
    dist: DISTRIBUTIONS[controls.dist.value],
    n: +controls.n.value,
    level: +controls.level.value,
    intervals: [],
    hits: 0,
    total: 0,
    nextId: 1,
    timer: null,
  };

  const x = d3.scaleLinear().range([margin.left, width - margin.right]);
  const yDensity = d3.scaleLinear().range([margin.top + densityHeight, margin.top]);
  const rowY = (i) => stackTop + i * rowHeight + rowHeight / 2;

  const chart = el('ci-chart');
  const svg = d3
    .select(chart)
    .append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('role', 'img')
    .attr('aria-label', 'Simulation von Konfidenzintervallen');

  svg
    .append('defs')
    .append('clipPath')
    .attr('id', 'ci-clip')
    .append('rect')
    .attr('x', margin.left)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height);

  const labels = svg.append('g').attr('class', 'row-label');
  labels.append('text').attr('x', margin.left).attr('y', margin.top - 12).text('Population');
  labels.append('text').attr('x', margin.left).attr('y', sampleY - 12).text('Stichprobe');
  labels
    .append('text')
    .attr('x', margin.left)
    .attr('y', stackTop - 8)
    .text('Konfidenzintervalle (neueste oben)');

  const plot = svg.append('g').attr('clip-path', 'url(#ci-clip)');
  const densityArea = plot.append('path').attr('class', 'density-area');
  const densityLine = plot.append('path').attr('class', 'density-line');
  const muLine = plot
    .append('line')
    .attr('class', 'mu-line')
    .attr('y1', margin.top - 4)
    .attr('y2', height - margin.bottom);
  const muLabel = svg
    .append('text')
    .attr('class', 'mu-label')
    .attr('y', margin.top - 10)
    .text('μ');
  const sampleGroup = plot.append('g');
  const stackGroup = plot.append('g');
  const xAxis = svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.bottom})`);

  const tooltip = d3.select(chart).append('div').attr('class', 'tooltip').attr('hidden', true);

  function drawDistribution() {
    const { domain, pdf, mean } = state.dist;
    x.domain(domain);
    const points = d3.range(domain[0], domain[1] + 0.005, 0.01).map((v) => [v, pdf(v)]);
    yDensity.domain([0, d3.max(points, (d) => d[1]) * 1.1]);

    const area = d3
      .area()
      .x((d) => x(d[0]))
      .y0(yDensity(0))
      .y1((d) => yDensity(d[1]));
    densityArea.datum(points).attr('d', area);
    densityLine.datum(points).attr('d', area.lineY1());

    muLine.attr('x1', x(mean)).attr('x2', x(mean));
    muLabel.attr('x', x(mean));
    xAxis.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  }

  function drawSample() {
    const { dist, n, level } = state;
    const values = Array.from({ length: n }, dist.sample);
    const mean = d3.mean(values);
    const half = (tQuantile(1 - (1 - level) / 2, n - 1) * d3.deviation(values)) / Math.sqrt(n);
    const interval = { id: state.nextId++, mean, lo: mean - half, hi: mean + half };
    interval.hit = interval.lo <= dist.mean && dist.mean <= interval.hi;

    state.total += 1;
    if (interval.hit) state.hits += 1;
    state.intervals.unshift(interval);
    if (state.intervals.length > maxRows) state.intervals.pop();

    // Stichprobenwerte fallen aus der Population in die Stichproben-Zeile
    sampleGroup
      .selectAll('circle')
      .data(values)
      .join('circle')
      .attr('class', 'sample-point')
      .attr('r', 4)
      .attr('cx', (d) => x(d))
      .attr('cy', yDensity(0))
      .attr('opacity', 0)
      .transition()
      .duration(duration)
      .attr('cy', sampleY)
      .attr('opacity', 1);

    // Neues Intervall oben einfügen, ältere rutschen nach unten
    stackGroup
      .selectAll('g.interval')
      .data(state.intervals, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', (d) => `interval ${d.hit ? 'hit' : 'miss'}`)
            .attr('transform', `translate(0,${sampleY})`)
            .attr('opacity', 0)
            .on('pointerenter pointermove', showTooltip)
            .on('pointerleave', hideTooltip);
          g.append('line')
            .attr('x1', (d) => x(d.lo))
            .attr('x2', (d) => x(d.hi));
          g.append('circle')
            .attr('r', 3)
            .attr('cx', (d) => x(d.mean));
          g.append('rect')
            .attr('class', 'hit-area')
            .attr('x', (d) => x(d.lo) - 4)
            .attr('width', (d) => Math.max(8, x(d.hi) - x(d.lo) + 8))
            .attr('y', -rowHeight / 2)
            .attr('height', rowHeight);
          return g;
        },
        (update) => update,
        (exit) => exit.transition().duration(duration).attr('opacity', 0).remove(),
      )
      .transition()
      .duration(duration)
      .attr('transform', (d, i) => `translate(0,${rowY(i)})`)
      .attr('opacity', 1);

    updateSummary();
  }

  function showTooltip(event, d) {
    const [px, py] = d3.pointer(event, chart);
    tooltip
      .attr('hidden', null)
      .html(
        `<strong>Stichprobe ${d.id}</strong><br>` +
          `x̄ = ${fmt.format(d.mean)}<br>` +
          `Intervall [${fmt.format(d.lo)}; ${fmt.format(d.hi)}]<br>` +
          (d.hit ? 'enthält μ' : 'verfehlt μ'),
      )
      .style('left', `${px}px`)
      .style('top', `${py}px`);
  }

  function hideTooltip() {
    tooltip.attr('hidden', true);
  }

  function updateSummary() {
    const { hits, total, level } = state;
    el('ci-coverage-text').textContent = total
      ? `${hits} von ${total} Intervallen enthalten μ (${pct.format(hits / total)}). ` +
        `Erwartet: ${pct.format(level)}.`
      : 'Noch keine Stichproben gezogen.';
    el('ci-coverage-fill').style.width = total ? `${(hits / total) * 100}%` : '0%';
    el('ci-coverage-target').style.left = `${level * 100}%`;
  }

  function reset() {
    state.intervals = [];
    state.hits = 0;
    state.total = 0;
    sampleGroup.selectAll('*').remove();
    stackGroup.selectAll('*').remove();
    hideTooltip();
    updateSummary();
  }

  function setRunning(running) {
    if (running) {
      drawSample();
      state.timer = d3.interval(drawSample, tickMs);
    } else {
      state.timer?.stop();
      state.timer = null;
    }
    controls.start.textContent = running ? 'Pause' : 'Start';
    controls.start.setAttribute('aria-pressed', running);
  }

  controls.start.addEventListener('click', () => setRunning(!state.timer));
  controls.step.addEventListener('click', drawSample);
  controls.reset.addEventListener('click', reset);
  controls.dist.addEventListener('change', () => {
    state.dist = DISTRIBUTIONS[controls.dist.value];
    drawDistribution();
    reset();
  });
  controls.n.addEventListener('input', () => {
    state.n = +controls.n.value;
    el('ci-n-value').textContent = state.n;
    reset();
  });
  controls.level.addEventListener('input', () => {
    state.level = +controls.level.value;
    el('ci-level-value').textContent = pct.format(state.level);
    reset();
  });

  drawDistribution();
  updateSummary();
}
