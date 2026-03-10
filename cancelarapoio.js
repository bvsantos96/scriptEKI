(function () {
    'use strict';

    console.log('[Kimmis] Script loaded');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        console.log('[Kimmis] init() called');
        console.log('[Kimmis] All h3s:');
        document.querySelectorAll('h3').forEach((h, i) => {
            console.log(i, `"${h.textContent}"`, h.textContent.charCodeAt(0), h.textContent.length);
        });
        // h3 "Defesas"
        const h3Defesas = Array.from(document.querySelectorAll('h3'))
            .find(h => h.textContent
                .normalize('NFKD')      // normalize accents
                .replace(/\s+/g, ' ')   // replace all whitespace sequences with a normal space
                .trim()
                .toLowerCase()
                .startsWith('defesa'));

        if (!h3Defesas) {
            console.log('[Kimmis] h3 "Defesas" não encontrado.');
            return;
        } else {
            console.log('[Kimmis] h3 "Defesas" encontrado:', h3Defesas.textContent);
        }

        // Tabela de apoios: id="units_home" dentro do <form>
        const defTable = document.getElementById('units_home');
        if (!defTable) {
            console.log('[Kimmis] Tabela de defesas (#units_home) não encontrada.');
            return;
        } else {
            console.log('[Kimmis] Tabela de defesas encontrada');
        }

        if (document.getElementById('kimmis-cancel-apoios')) {
            console.log('[Kimmis] Painel já existe, sair.');
            return;
        }

        const UNIT_NAMES = [
            'Lanceiro',
            'Espadachim',
            'Viking',
            'Batedor',
            'Cavalaria leve',
            'Cavalaria Pesada',
            'Aríete',
            'Catapulta',
            'Nobre',
            'Milícia'
        ];

        const rows = Array.from(defTable.querySelectorAll('tr')).slice(1); // ignora cabeçalho
        console.log('[Kimmis] Número de linhas na tabela de defesas:', rows.length);

        // --- Agrupar por jogador ---
        const players = {}; // { playerName: { rows:[tr,...], totals:[11] } }

        rows.forEach((tr, index) => {
            console.log(`[Kimmis] Processando linha ${index + 1}`);

            const checkbox = tr.querySelector('input[type="checkbox"]');
            if (!checkbox) {
                console.log('[Kimmis] Linha sem checkbox, pular');
                return; // linha "Desta aldeia" não tem checkbox
            }

            const tds = tr.querySelectorAll('td');
            if (tds.length < 5) {
                console.log('[Kimmis] Linha com poucas colunas, pular');
                return;
            }

            const originText = (tds[1].textContent || '').trim();
            console.log('[Kimmis] originText:', originText);

            // 🐛 CORREÇÃO DE BUG: Extração do nome do jogador
            let playerName = null;
            const regex = /\(([^)]+)\)\s*(\(\d+\|\d+\))/g;
            let match;
            
            let lastMatch = null;
            while ((match = regex.exec(originText)) !== null) {
                lastMatch = match;
            }

            if (lastMatch && lastMatch[1]) {
                playerName = lastMatch[1]; 
                console.log('[Kimmis] Jogador encontrado:', playerName);
            }
            
            if (!playerName) {
                console.warn(`[Kimmis] Não foi possível extrair o nome do jogador para: ${originText}`);
                return;
            }

            if (!players[playerName]) {
                players[playerName] = {
                    rows: [],
                    totals: new Array(UNIT_NAMES.length).fill(0)
                };
            }
            players[playerName].rows.push(tr);

            const offset = tds.length - UNIT_NAMES.length;
            for (let i = 0; i < UNIT_NAMES.length; i++) {
                const cell = tds[offset + i];
                if (!cell) continue;
                const val = parseInt(cell.textContent.replace(/\./g, '').trim(), 10) || 0;
                players[playerName].totals[i] += val;
            }
        });

        const playerNames = Object.keys(players);
        console.log('[Kimmis] Jogadores encontrados:', playerNames);

        createPanel(h3Defesas, defTable, players, playerNames, UNIT_NAMES);
        console.log('[Kimmis] Painel criado');
    }

    function createPanel(h3Defesas, defTable, players, playerNames, UNIT_NAMES) {
        console.log('[Kimmis] createPanel() called');

        const container = document.createElement('div');
        container.id = 'kimmis-cancel-apoios';
        container.style.margin = '10px 0';
        container.style.padding = '8px';
        container.style.border = '1px solid #c0a000';
        container.style.background = '#f9f3e9';
        container.style.fontSize = '12px';

        container.innerHTML = `
            <div style="font-weight:bold; margin-bottom:5px;">
                Cancelar apoios por jogador
            </div>
            <div style="margin-bottom:5px;">
                Jogadores a apoiar esta aldeia: <b>${playerNames.length}</b>
            </div>
            <div id="kimmis-player-list" style="max-height:160px; overflow-y:auto; border:1px solid #e0c880; padding:4px; background:#fffdf5;">
                ${playerNames.length === 0 ? '<i>Sem apoios de outros jogadores.</i>' : ''}
            </div>
            <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" id="kimmis-clear-selection">Limpar seleção</button>
                <button type="button" id="kimmis-select-all">Selecionar todos os apoios</button>
                <button type="button" id="kimmis-send-back">Enviar de volta (selecionados)</button>
            </div>
        `;

        const selectEl = document.querySelector('select[name="display"]');
        const selectDiv = selectEl ? selectEl.closest('div') : null;

        if (selectDiv && selectDiv.parentNode) {
            console.log('[Kimmis] Inserindo painel após seletor de display');
            selectDiv.parentNode.insertBefore(container, selectDiv.nextSibling);
        } else {
            console.log('[Kimmis] Inserindo painel antes do h3 "Defesas" (fallback)');
            h3Defesas.parentNode.insertBefore(container, h3Defesas);
        }

        const listDiv = container.querySelector('#kimmis-player-list');

        playerNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        playerNames.forEach(name => {
            const data = players[name];
            const parts = [];
            data.totals.forEach((val, idx) => {
                if (val > 0) parts.push(`${val.toLocaleString('pt-PT')} ${UNIT_NAMES[idx]}`);
            });
            const summary = parts.join(', ') || '0 tropas';

            const row = document.createElement('div');
            row.style.marginBottom = '3px';
            row.innerHTML = `
                <label style="cursor:pointer;">
                    <input type="checkbox" name="kimmis-player-checkbox" value="${name.replace(/"/g, '&quot;')}">
                    <b>${name}</b> – ${summary}
                </label>
            `;
            listDiv.appendChild(row);
        });

        console.log('[Kimmis] Lista de jogadores populada no painel');
    }

})();
