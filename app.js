document.addEventListener('DOMContentLoaded', () => {

  // Navigation
  const navLinks = document.querySelectorAll('#sidebar a[data-section]');
  const sections = document.querySelectorAll('.section');

  function showSection(id) {
    sections.forEach(s => s.classList.remove('active'));
    navLinks.forEach(a => a.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    const link = document.querySelector(`[data-section="${id}"]`);
    if (link) link.classList.add('active');
    window.scrollTo(0, 0);
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showSection(link.dataset.section);
    });
  });

  // Accordion
  document.querySelectorAll('.accordion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling;
      const isOpen = body.classList.contains('open');
      document.querySelectorAll('.accordion-body').forEach(b => b.classList.remove('open'));
      document.querySelectorAll('.accordion-btn').forEach(b => b.classList.remove('open'));
      if (!isOpen) { body.classList.add('open'); btn.classList.add('open'); }
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.tab-group');
      group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      group.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = group.querySelector('#tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Scenario filter
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.scenario-card').forEach(card => {
        if (filter === 'all' || card.dataset.tags.includes(filter)) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // LIVE SANDBOX
  const runBtn = document.getElementById('sandbox-run');
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      const raw = document.getElementById('sandbox-input').value.trim();
      if (!raw) return;

      const logEl = document.getElementById('sandbox-log');
      const tableEl = document.getElementById('sandbox-output-table');
      logEl.innerHTML = '';
      tableEl.innerHTML = '';

      const lines = raw.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        logEl.innerHTML = '<span class="log-warn">Need at least a header row and one data row.</span>';
        return;
      }

      const baseHeaders = lines[0].split(',').map(h => h.trim());
      let rows = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj = {};
        baseHeaders.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
        return obj;
      });

      const logs = [];
      const inCount = rows.length;
      logs.push(`<span class="log-info">[INPUT] ${inCount} rows loaded, ${baseHeaders.length} columns: ${baseHeaders.join(', ')}</span>`);

      const ops = {
        lowercase:    document.getElementById('op-lowercase').checked,
        trim:         document.getElementById('op-trim').checked,
        dedup:        document.getElementById('op-dedup').checked,
        nullify:      document.getElementById('op-nullify').checked,
        negatives:    document.getElementById('op-negatives').checked,
        emailvalidate: document.getElementById('op-emailvalidate').checked,
      };

      if (ops.trim) {
        rows = rows.map(row => {
          const r = {};
          baseHeaders.forEach(h => { r[h] = row[h].trim(); });
          return r;
        });
        logs.push('<span class="log-ok">[TRIM] Whitespace trimmed from all cells.</span>');
      }

      if (ops.lowercase) {
        rows = rows.map(row => {
          const r = {};
          Object.keys(row).forEach(h => {
            const v = row[h];
            r[h] = (isNaN(v) || v === '') ? v.toLowerCase() : v;
          });
          return r;
        });
        logs.push('<span class="log-ok">[LOWERCASE] Text columns lowercased.</span>');
      }

      if (ops.nullify) {
        let nullCount = 0;
        rows = rows.map(row => {
          const r = {};
          Object.keys(row).forEach(h => {
            if (row[h] === '') { r[h] = 'NULL'; nullCount++; } else { r[h] = row[h]; }
          });
          return r;
        });
        logs.push(`<span class="log-ok">[NULLIFY] ${nullCount} empty cell(s) replaced with NULL.</span>`);
      }

      if (ops.dedup) {
        const before = rows.length;
        const seen = new Set();
        rows = rows.filter(row => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const dropped = before - rows.length;
        logs.push(`<span class="${dropped > 0 ? 'log-warn' : 'log-ok'}">[DEDUP] ${dropped} duplicate row(s) removed. ${rows.length} rows remain.</span>`);
      }

      const extraHeaders = [];

      if (ops.negatives) {
        const revenueCol = baseHeaders.find(h =>
          h.toLowerCase().includes('revenue') ||
          h.toLowerCase().includes('amount') ||
          h.toLowerCase().includes('price')
        );
        if (revenueCol) {
          let flagged = 0;
          rows = rows.map(row => {
            const v = parseFloat(row[revenueCol]);
            if (!isNaN(v) && v < 0) { row['_flag_negative'] = '⚠️ negative'; flagged++; }
            return row;
          });
          if (flagged > 0 && !extraHeaders.includes('_flag_negative')) extraHeaders.push('_flag_negative');
          logs.push(`<span class="log-warn">[NEGATIVES] ${flagged} row(s) flagged with negative ${revenueCol}.</span>`);
        } else {
          logs.push('<span class="log-warn">[NEGATIVES] No revenue/amount/price column found.</span>');
        }
      }

      if (ops.emailvalidate) {
        const emailCol = baseHeaders.find(h => h.toLowerCase().includes('email'));
        if (emailCol) {
          const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          let flagged = 0;
          rows = rows.map(row => {
            const v = row[emailCol];
            if (v && v !== 'NULL' && v !== 'null' && !emailRe.test(v)) {
              row['_flag_email'] = '⚠️ invalid';
              flagged++;
            }
            return row;
          });
          if (flagged > 0 && !extraHeaders.includes('_flag_email')) extraHeaders.push('_flag_email');
          logs.push(`<span class="log-warn">[EMAIL] ${flagged} row(s) flagged with invalid email.</span>`);
        } else {
          logs.push('<span class="log-warn">[EMAIL] No email column found.</span>');
        }
      }

      logs.push(`<span class="log-info">[OUTPUT] ${rows.length} rows (dropped ${inCount - rows.length} total).</span>`);
      logEl.innerHTML = logs.join('\n');

      // Render table using stable column order: base columns + any flag columns
      const allHeaders = [...baseHeaders, ...extraHeaders];
      let html = '<table><thead><tr>';
      allHeaders.forEach(h => { html += `<th>${h}</th>`; });
      html += '</tr></thead><tbody>';
      rows.forEach(row => {
        html += '<tr>';
        allHeaders.forEach(h => {
          const v = row[h] !== undefined ? row[h] : '';
          const isFlag = h.startsWith('_flag');
          html += `<td style="${isFlag ? 'color:#ffa94d' : ''}">${v}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      tableEl.innerHTML = html;
    });
  }

}); // end DOMContentLoaded
