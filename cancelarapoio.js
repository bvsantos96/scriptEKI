(function () {
    'use strict';

    window.addEventListener('load', init);

    function init() {
        // h3 "Defesas"
        const h3Defesas = Array.from(document.querySelectorAll('h3'))
            .find(h => h.textContent.trim().toLowerCase().startsWith('defesas'));

        if (!h3Defesas) {
            console.log('[Kimmis] h3 "Defesas" não encontrado.');
            return;
        }

        // Tabela de apoios: id="units_home" dentro do <form>
        const defTable = document.getElementById('units_home');
        if (!defTable) {
            console.log('[Kimmis] Tabela de defesas (#units_home) não encontrada.');
            return;
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

        // --- Agrupar por jogador ---
        const players = {}; // { playerName: { rows:[tr,...], totals:[11] } }

        rows.forEach(tr => {
            const checkbox = tr.querySelector('input[type="checkbox"]');
            if (!checkbox) return; // linha "Desta aldeia" não tem checkbox

            const tds = tr.querySelectorAll('td');
            if (tds.length < 5) return;

            const originText = (tds[1].textContent || '').trim();

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
            }
            
            if (!playerName) {
                console.warn(`[Kimmis] Não foi possível extrair o nome do jogador para: ${originText}`);
                return;
            }
            // ----------------------------------------

            if (!players[playerName]) {
                players[playerName] = {
                    rows: [],
                    totals: new Array(UNIT_NAMES.length).fill(0)
                };
            }
            players[playerName].rows.push(tr);

            // Últimas 11 colunas = tropas (os ícones estão no cabeçalho; aqui só números)
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
    }

    function createPanel(h3Defesas, defTable, players, playerNames, UNIT_NAMES) {
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

        // Inserir ENTRE o div do seletor e o h3 "Defesas"
        const selectEl = document.querySelector('select[name="display"]');
        const selectDiv = selectEl ? selectEl.closest('div') : null;

        if (selectDiv && selectDiv.parentNode) {
            selectDiv.parentNode.insertBefore(container, selectDiv.nextSibling);
        } else {
            // fallback: antes do h3
            h3Defesas.parentNode.insertBefore(container, h3Defesas);
        }

        const listDiv = container.querySelector('#kimmis-player-list');

        // --- Preencher lista de jogadores ---
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

        // Opção "Nenhum" (apenas para efeitos de 'Limpar', já não é um input que controla a seleção)
        // Removido o input "Nenhum jogador" pois as checkboxes tratam disso implicitamente.

        // --- Funções auxiliares ---

        // Função para limpar TODAS as checkboxes na tabela de apoios
        function clearAllTableCheckboxes() {
            defTable.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }
        
        // Função para limpar APENAS as checkboxes do painel de jogadores
        function clearAllPlayerCheckboxes() {
            listDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }

        // Função principal de seleção/desseleção
        function togglePlayerSupports(playerName, checked) {
            if (!playerName || !players[playerName]) return;
            players[playerName].rows.forEach(tr => {
                const cb = tr.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = checked;
            });
        }

        // Função que sincroniza a seleção do painel com a tabela
        function syncTableSelection() {
            // 1. Limpa todas as seleções na tabela original de apoios
            clearAllTableCheckboxes(); 

            // 2. Itera sobre os jogadores selecionados no painel e seleciona os apoios correspondentes na tabela.
            listDiv.querySelectorAll('input[name="kimmis-player-checkbox"]:checked').forEach(cb => {
                const playerName = cb.value;
                if (players[playerName]) {
                    players[playerName].rows.forEach(tr => {
                        const supportCb = tr.querySelector('input[type="checkbox"]');
                        if (supportCb) supportCb.checked = true;
                    });
                }
            });
        }

        // --- Eventos ---
        
        // Evento de mudança em qualquer checkbox do jogador
        listDiv.addEventListener('change', function (e) {
            const target = e.target;
            if (target && target.name === 'kimmis-player-checkbox') {
                // Ao clicar num jogador, a seleção na tabela é refeita com base em todos os jogadores marcados
                syncTableSelection();
            }
        });

        // Botão "Limpar seleção"
        container.querySelector('#kimmis-clear-selection').addEventListener('click', function () {
            clearAllPlayerCheckboxes(); // Limpa as checkboxes do painel
            clearAllTableCheckboxes(); // Limpa as checkboxes na tabela de apoios
        });
        
        // NOVO Botão "Selecionar todos os apoios"
        container.querySelector('#kimmis-select-all').addEventListener('click', function () {
            listDiv.querySelectorAll('input[name="kimmis-player-checkbox"]').forEach(cb => {
                cb.checked = true;
            });
            syncTableSelection(); // Sincroniza a tabela para incluir todos os apoios
        });


        // Botão "Enviar de volta"
        container.querySelector('#kimmis-send-back').addEventListener('click', function () {
            const checkedSupports = defTable.querySelectorAll('input[type="checkbox"]:checked');
            if(checkedSupports.length === 0){
                 alert('Não existe nenhum apoio selecionado para enviar de volta.');
                 return;
            }
            
            const backBtn = document.querySelector('input.btn[name="back"]');
            if (!backBtn) {
                alert('Não foi encontrado o botão "Enviar de volta" na página.');
                return;
            }
            
            // Confirmação com o número de apoios a serem enviados
            if (confirm(`Têm a certeza que quer enviar de volta os ${checkedSupports.length} apoios selecionados?`)) {
                 backBtn.click();
            }
        });
    }

})();
