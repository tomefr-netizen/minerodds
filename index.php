<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>MinerOdds | Every hash is a chance</title>
  <script>try{document.documentElement.dataset.theme=localStorage.getItem('minerodds-theme')||'dark'}catch(e){}</script>
  <link rel="stylesheet" href="assets/style.css">
  <script src="assets/lucide.js" defer></script>
  <script src="assets/app.js" type="module"></script>
</head>
<body>
  <header class="topbar"><a class="brand" href="./"><i data-lucide="cpu"></i>Miner<span>Odds</span></a><div class="header-right"><span class="algorithm">SHA-256d</span><button class="icon-button" id="theme" aria-label="Switch to light theme" title="Switch theme"><i data-lucide="sun"></i></button></div></header>
  <main>
    <div class="page-heading"><div><span class="eyebrow">THE SMALL MINER'S WORKBENCH</span><h1>Every hash is a chance.</h1></div><div class="data-status" id="data-status" role="status"><span class="status-dot"></span>Fetching network data...</div></div>
    <form id="settings" class="settings" novalidate>
      <div class="hash-field"><label for="hashrate">Your hashrate</label><div class="input-wrap"><input id="hashrate" name="hashrate" type="number" min="0" max="1000000000" step="any" value="1" inputmode="decimal"><span>TH/s</span></div></div>
      <div class="preset-field"><span class="field-label">Quick set</span><div class="presets"><button type="button" data-hash="0.5">0.5</button><button type="button" data-hash="1">1</button><button type="button" data-hash="5">5</button><button type="button" data-hash="10">10</button><button type="button" data-hash="100">100 <small>TH/s</small></button></div></div>
      <div><label for="uptime">Uptime</label><div class="input-wrap"><input id="uptime" name="uptime" type="number" min="0" max="100" step="any" value="100"><span>%</span></div></div>
      <div class="pool-input" hidden><label for="power">Power draw</label><div class="input-wrap"><input id="power" name="power" type="number" min="0" max="1000000000" step="any" value="20"><span>W</span></div></div>
      <div class="pool-input" hidden><label for="electricity">Electricity</label><div class="input-wrap"><input id="electricity" name="electricity" type="number" min="0" max="1000" step="any" value="0.15"><span id="electricity-unit">$/kWh</span></div></div>
      <div class="pool-input" hidden><label for="fee">Pool fee</label><div class="input-wrap"><input id="fee" name="fee" type="number" min="0" max="100" step="any" value="1"><span>%</span></div></div>
      <p id="input-error" class="input-error" hidden role="alert"></p>
    </form>
    <div class="summary" id="summary" aria-live="polite"></div>
    <section class="comparison" aria-label="Cryptocurrency comparison">
      <div class="table-toolbar"><div class="tabs" role="tablist" aria-label="Mining mode"><button id="solo-tab" type="button" role="tab" aria-selected="true" aria-controls="results"><i data-lucide="pickaxe"></i>Solo odds</button><button id="pool-tab" type="button" role="tab" aria-selected="false" aria-controls="results"><i data-lucide="users"></i>Pool earnings</button></div><div class="table-tools"><label class="currency-picker" for="currency"><i data-lucide="banknote"></i><select id="currency" aria-label="Display currency"><option value="USD">USD</option></select></label><div class="search"><i data-lucide="search"></i><input id="search" type="search" placeholder="Find a coin" aria-label="Find a coin"></div><button class="icon-button" id="export" title="Export comparison as CSV" aria-label="Export comparison as CSV"><i data-lucide="download"></i></button></div></div>
      <div id="results" role="tabpanel" aria-labelledby="solo-tab"><div class="table-scroll"><table><thead id="table-head"></thead><tbody id="table-body"><tr><td class="empty">Loading chains...</td></tr></tbody></table></div></div>
      <div class="table-bottom"><span id="coin-count">8 supported chains</span><span><span id="currency-status">USD</span> <span class="separator">/</span> Month = 30 days <span class="separator">/</span> Year = 365 days</span></div>
    </section>
    <section class="detail" id="detail" hidden aria-live="polite"></section>
    <footer><p>Probabilities, not promises. Estimates hold difficulty, rewards and prices constant. A mean wait is not a deadline: at that time, the chance of at least one block is about 63.2%.</p><div><span>MinerOdds <small>MVP</small></span><span>Data: <a href="https://solofury.com/block-info/api/" target="_blank" rel="noopener">SoloFury</a>, <a href="https://bcmonster.com/api.html" target="_blank" rel="noopener">BCMonster</a> &amp; <a href="https://backpow.com/api" target="_blank" rel="noopener">BackPoW</a></span></div></footer>
  </main>
</body>
</html>
