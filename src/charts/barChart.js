import * as d3 from 'd3';

/**
 * Zeichnet ein einfaches Balkendiagramm in den Container.
 * @param {string} selector  CSS-Selektor des Containers
 * @param {object[]} data    Datenzeilen
 * @param {{x: string, y: string}} keys  Spaltennamen für Kategorie und Wert
 */
export function barChart(selector, data, { x, y }) {
  const width = 640;
  const height = 360;
  const margin = { top: 20, right: 20, bottom: 40, left: 48 };

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d[x]))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[y])])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const svg = d3
    .select(selector)
    .append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('role', 'img');

  svg
    .append('g')
    .attr('class', 'bars')
    .selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', (d) => xScale(d[x]))
    .attr('y', (d) => yScale(d[y]))
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => yScale(0) - yScale(d[y]))
    .append('title')
    .text((d) => `${d[x]}: ${d[y]}`);

  svg
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5));

  return svg.node();
}
