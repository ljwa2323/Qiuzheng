/* Legacy prototype UI removed. Use apps/web with the API-backed workspace. */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = '<main style="font-family:system-ui;padding:48px;max-width:640px;margin:0 auto;line-height:1.6"><h1>Qiuzheng</h1><p>Root prototype UI has been removed. Start the real workspace with <code>npm run windows:start</code> or <code>npm run dev:web</code> (apps/web).</p></main>';
  }
});
