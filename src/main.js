import * as d3 from 'd3';
import './style.css';
import { barChart } from './charts/barChart.js';

// Dateien in public/ sind unter dem Wurzelpfad erreichbar
d3.csv('/data/sample.csv', d3.autoType).then((data) => {
  barChart('#bar-chart', data, { x: 'kategorie', y: 'wert' });
});
