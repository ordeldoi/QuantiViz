import './style.css';
import { confidenceIntervalDemo } from './charts/confidenceInterval.js';
import { samplingDemo } from './charts/sampling.js';

confidenceIntervalDemo(document.querySelector('#ci'));
samplingDemo(document.querySelector('#stichprobe'));
