import { render } from 'preact';
import { App } from './App';
import { startBackgroundSync } from './store';
import './styles.css';

render(<App />, document.getElementById('app')!);
startBackgroundSync();
