const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  import('./App.js').then(mod => {
    const App = mod.default;
    root.render(React.createElement(App));
  });
}