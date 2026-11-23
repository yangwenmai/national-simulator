// 引导战役。规则只在 CAMPAIGN_LEVELS 里。提示和胜负都从这张表加上当前棋盘算。

const CAMPAIGN_STORAGE_KEY = 'nbs-campaign-level';

const CAMPAIGN_LEVELS = [
    {
        id: 'farm',
        title: '第一关',
        aha: '盖一座农场，结束回合，金币就会变多。',
        width: 5,
        height: 5,
        buildings: ['farm'],
        units: [],
        spotlight: { x: 2, y: 2 },
        win: 'farmIncome',
        players: [
            {
                name: '你',
                gold: 150,
                capital: { x: 1, y: 2 },
                territory: [{ x: 2, y: 2 }]
            }
        ]
    },
    {
        id: 'soldier',
        title: '第二关',
        aha: '招一个步兵，点一下就能打掉旁边的敌人。',
        width: 6,
        height: 4,
        buildings: [],
        units: ['infantry'],
        spotlight: { x: 2, y: 1 },
        win: 'enemyUnitsGone',
        recruitActsImmediately: true,
        players: [
            {
                name: '你',
                gold: 50,
                capital: { x: 1, y: 1 },
                territory: [{ x: 2, y: 1 }],
                buildings: [{ type: 'barracks', x: 1, y: 2 }]
            },
            {
                name: '对面',
                gold: 0,
                isAI: true,
                script: 'punish',
                capital: { x: 5, y: 1 },
                units: [{ type: 'infantry', x: 3, y: 1, health: 5, attack: 200 }]
            }
        ]
    },
    {
        id: 'capital',
        title: '第三关',
        aha: '打掉对面的首都，这一关就赢了。',
        width: 6,
        height: 4,
        buildings: [],
        units: [],
        win: 'enemyCapitalGone',
        players: [
            {
                name: '你',
                gold: 0,
                capital: { x: 1, y: 2 },
                units: [{ type: 'infantry', x: 2, y: 2, couldAttack: true }]
            },
            {
                name: '对面',
                gold: 0,
                isAI: true,
                script: 'punish',
                capital: { x: 3, y: 2, health: 5 },
                units: [{ type: 'infantry', x: 2, y: 1, health: 40, attack: 200 }]
            }
        ]
    }
];

function campaignLoadIndex() {
    try {
        const n = parseInt(localStorage.getItem(CAMPAIGN_STORAGE_KEY) || '0', 10);
        if (!Number.isInteger(n) || n < 0 || n >= CAMPAIGN_LEVELS.length) return 0;
        return n;
    } catch (err) {
        return 0;
    }
}

function campaignSaveIndex(index) {
    try {
        localStorage.setItem(CAMPAIGN_STORAGE_KEY, String(index));
    } catch (err) {
        // 浏览器把本地存储关掉时，这一局照样能玩完。
    }
}

function campaignIndex() {
    if (!gameState || !gameState.campaign) return -1;
    return CAMPAIGN_LEVELS.findIndex(level => level.id === gameState.campaign.levelId);
}

function campaignLevel() {
    const index = campaignIndex();
    if (index < 0) return null;
    return CAMPAIGN_LEVELS[index];
}

function campaignAllowsBuilding(type) {
    if (!gameState || !gameState.campaign) return true;
    const level = campaignLevel();
    return !!(level && level.buildings.indexOf(type) !== -1);
}

function campaignAllowsUnit(type) {
    if (!gameState || !gameState.campaign) return true;
    const level = campaignLevel();
    return !!(level && level.units.indexOf(type) !== -1);
}

function campaignSpotlight() {
    const level = campaignLevel();
    return level ? level.spotlight : null;
}

function campaignRecruitAllowed(x, y) {
    const spot = campaignSpotlight();
    if (!gameState.campaign || !spot) return true;
    return spot.x === x && spot.y === y;
}

function campaignAfterRecruit(unit) {
    const level = campaignLevel();
    if (!level || !level.recruitActsImmediately || !unit) return;
    unit.hasActed = false;
    unit.hasAttacked = false;
    unit._couldAttack = true;
}

function campaignStopTimer() {
    if (typeof gameState !== 'undefined' && gameState && gameState._timerInterval) {
        clearInterval(gameState._timerInterval);
        gameState._timerInterval = null;
    }
}

function campaignClearChrome() {
    document.body.classList.remove('campaign');
    document.body.removeAttribute('data-level');
    document.body.removeAttribute('data-hide-build');
    document.body.removeAttribute('data-hide-military');
    const banner = document.getElementById('campaign-banner');
    if (banner) banner.hidden = true;
    const overlay = document.getElementById('campaign-overlay');
    if (overlay) overlay.remove();
    document.querySelectorAll('.campaign-pulse').forEach(el => el.classList.remove('campaign-pulse'));
}

function campaignPlaceBuilding(x, y, ownerId, type, health) {
    const tile = getTileAt(gameState.map, x, y);
    tile.terrain = 'plain';
    tile.ownerId = ownerId;
    tile.building = {
        type: type,
        name: BUILDINGS[type].name,
        income: BUILDINGS[type].income,
        health: health != null ? health : BUILDINGS[type].maxHealth,
        id: generateBuildingId()
    };
}

function campaignPlaceUnit(x, y, ownerId, spec) {
    const tile = getTileAt(gameState.map, x, y);
    const def = UNITS[spec.type];
    tile.terrain = 'plain';
    tile.unit = {
        type: spec.type,
        ownerId: ownerId,
        health: spec.health != null ? spec.health : def.health,
        maxHealth: spec.health != null ? spec.health : def.health,
        attack: spec.attack != null ? spec.attack : def.attack,
        defense: spec.defense != null ? spec.defense : def.defense,
        x: x,
        y: y,
        hasActed: false,
        hasMoved: false,
        hasAttacked: false,
        _couldAttack: !!spec.couldAttack,
        id: generateUnitId()
    };
    gameState.players[ownerId].units.push(tile.unit);
}

function startCampaignLevel(index) {
    const level = CAMPAIGN_LEVELS[index];
    if (!level) return;

    campaignStopTimer();
    const overlay = document.getElementById('campaign-overlay');
    if (overlay) overlay.remove();

    const aiIndices = [];
    level.players.forEach((spec, i) => {
        if (spec.isAI) aiIndices.push(i);
    });

    GRID_WIDTH = level.width;
    GRID_HEIGHT = level.height;
    initGameState(level.players.length, aiIndices);

    gameState.campaign = { levelId: level.id, presented: false, soldierDown: false };
    level.players.forEach((spec, i) => {
        const player = gameState.players[i];
        player.name = spec.name;
        player.gold = spec.gold;
        player.campaignScript = spec.script || null;
    });

    gameState.map = initializeMap();
    level.players.forEach((spec, i) => {
        if (spec.capital) {
            campaignPlaceBuilding(spec.capital.x, spec.capital.y, i, 'capital', spec.capital.health);
        }
        (spec.territory || []).forEach(cell => {
            const tile = getTileAt(gameState.map, cell.x, cell.y);
            tile.terrain = 'plain';
            tile.ownerId = i;
        });
        (spec.buildings || []).forEach(building => {
            campaignPlaceBuilding(building.x, building.y, i, building.type, building.health);
        });
        (spec.units || []).forEach(unit => {
            campaignPlaceUnit(unit.x, unit.y, i, unit);
        });
    });

    for (let i = 0; i < gameState.players.length; i++) {
        syncPlayerBuildings(i);
        updatePlayerIncome(gameState.players[i]);
    }

    document.body.classList.add('campaign');
    resizeCanvas();
    if (level.units.length && !level.buildings.length && typeof openTab === 'function') {
        openTab('military-tab');
    } else if (typeof openTab === 'function') {
        openTab('building-tab');
    }
    updateGameStateDisplay();
    drawMap();
    addLogEntry(`${level.title}。${level.aha}`);
}

function campaignUnits(ownerId) {
    const found = [];
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === ownerId && tile.unit.health > 0) {
            found.push(tile.unit);
        }
    }
    return found;
}

function campaignEnemyCapitals() {
    const found = [];
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.building && tile.building.type === 'capital' && tile.ownerId !== 0 && tile.building.health > 0) {
            found.push(tile);
        }
    }
    return found;
}

function campaignWinMet() {
    const level = campaignLevel();
    if (!level) return false;
    if (level.win === 'farmIncome') {
        const farm = gameState.map.some(tile => tile.ownerId === 0 && tile.building && tile.building.type === 'farm');
        return farm && gameState.turn >= 2;
    }
    if (level.win === 'enemyUnitsGone') {
        for (let i = 1; i < gameState.players.length; i++) {
            if (campaignUnits(i).length > 0) return false;
        }
        return gameState.players.length > 1;
    }
    if (level.win === 'enemyCapitalGone') {
        return campaignEnemyCapitals().length === 0;
    }
    return false;
}

function campaignCue() {
    const level = campaignLevel();
    if (!level || gameState.campaign.presented) return {};

    if (level.win === 'farmIncome') {
        const queued = gameState.buildingQueue.some(item => item.type === 'farm' && item.ownerId === 0);
        const built = gameState.map.some(tile => tile.ownerId === 0 && tile.building && tile.building.type === 'farm');
        if (!queued && !built) {
            if (gameState.selectedBuildingType === 'farm') return { tile: level.spotlight };
            return { pulse: '.building-btn[data-building-type="farm"]' };
        }
        if (!built) return { pulse: '#end-turn-btn' };
        return { pulse: '#campaign-gold' };
    }

    if (level.win === 'enemyUnitsGone') {
        const soldiers = campaignUnits(0).filter(unit => unit.type === 'infantry');
        if (soldiers.length === 0) {
            if (gameState.recruitMode && gameState.selectedUnitType === 'infantry') return { tile: level.spotlight };
            return { pulse: '.military-button[data-unit-type="infantry"]' };
        }
        const soldier = soldiers[0];
        if (!gameState.selectedUnit || gameState.selectedUnit.id !== soldier.id) {
            return { tile: { x: soldier.x, y: soldier.y } };
        }
        if (!gameState.attackMode) return { pulse: '#attack-btn' };
        const foes = campaignUnits(1);
        if (foes.length) return { tile: { x: foes[0].x, y: foes[0].y } };
        return {};
    }

    if (level.win === 'enemyCapitalGone') {
        const soldiers = campaignUnits(0).filter(unit => unit.type === 'infantry');
        if (soldiers.length === 0) return {};
        const soldier = soldiers[0];
        if (!gameState.selectedUnit || gameState.selectedUnit.id !== soldier.id) {
            return { tile: { x: soldier.x, y: soldier.y } };
        }
        if (!gameState.attackMode) return { pulse: '#attack-btn' };
        const caps = campaignEnemyCapitals();
        if (caps.length) return { tile: { x: caps[0].x, y: caps[0].y } };
        return {};
    }

    return {};
}

function campaignApplyChrome() {
    const level = campaignLevel();
    const banner = document.getElementById('campaign-banner');
    if (!level) {
        campaignClearChrome();
        return;
    }
    document.body.classList.add('campaign');
    document.body.dataset.level = level.id;
    document.body.dataset.hideBuild = level.buildings.length ? '0' : '1';
    document.body.dataset.hideMilitary = level.units.length ? '0' : '1';
    if (banner) {
        banner.hidden = false;
        const kicker = document.getElementById('campaign-kicker');
        const aha = document.getElementById('campaign-aha');
        if (kicker) kicker.textContent = level.title;
        if (aha) aha.textContent = level.aha;
    }
    const turn = document.getElementById('turn-display');
    if (turn && !gameState.isGameOver) turn.textContent = level.title;
}

function campaignApplyCue(cue) {
    document.querySelectorAll('.campaign-pulse').forEach(el => el.classList.remove('campaign-pulse'));
    if (cue && cue.pulse) {
        const target = document.querySelector(cue.pulse);
        if (target) target.classList.add('campaign-pulse');
    }
    if (!gameState.map) return;
    for (let i = 0; i < gameState.map.length; i++) {
        gameState.map[i].highlight = null;
    }
    if (cue && cue.tile) {
        const tile = getTileAt(gameState.map, cue.tile.x, cue.tile.y);
        if (tile) {
            tile.highlight = { color: 'rgba(241, 196, 15, 0.55)' };
        }
    }
}

function campaignTouch() {
    if (!gameState || !gameState.campaign || gameState.campaign._touch) return;
    gameState.campaign._touch = true;
    try {
        const level = campaignLevel();
        if (level && level.win === 'farmIncome' && gameState.turn === 1) {
            gameState.campaign.goldBefore = gameState.players[0].gold;
        }
        campaignApplyChrome();
        campaignApplyCue(campaignCue());
    } finally {
        gameState.campaign._touch = false;
    }
}

function campaignPresentWin() {
    if (!gameState.campaign || gameState.campaign.presented) return;
    gameState.campaign.presented = true;
    gameState.isGameOver = true;

    const index = campaignIndex();
    const level = CAMPAIGN_LEVELS[index];
    const next = index + 1;
    const finished = next >= CAMPAIGN_LEVELS.length;
    campaignSaveIndex(finished ? 0 : next);

    const existing = document.getElementById('campaign-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'campaign-overlay';

    const card = document.createElement('div');
    card.id = 'campaign-card';

    const title = document.createElement('h2');
    title.textContent = finished ? '三关都过了' : `${level.title}过了`;

    const line = document.createElement('p');
    if (level.win === 'farmIncome') {
        const before = gameState.campaign.goldBefore;
        const now = gameState.players[0].gold;
        line.textContent = before != null
            ? `农场盖好了。金币从 ${before} 变成了 ${now}。`
            : `农场盖好了。你现在有 ${now} 金币。`;
    } else if (level.win === 'enemyUnitsGone') {
        line.textContent = '旁边的敌人被打掉了。';
    } else {
        line.textContent = '对面的首都被打掉了。';
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = finished ? '从第一关再来' : '下一关';
    button.addEventListener('click', () => {
        startCampaignLevel(finished ? 0 : next);
    });

    card.appendChild(title);
    card.appendChild(line);
    card.appendChild(button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function campaignRestart(message) {
    const index = campaignIndex();
    if (index < 0) return;
    showNotification(message, 'warning');
    startCampaignLevel(index);
}

function campaignResolve() {
    if (!gameState || !gameState.campaign || gameState.campaign.presented || gameState.campaign._resolving) {
        return false;
    }
    gameState.campaign._resolving = true;
    try {
        if (gameState.campaign.soldierDown && campaignUnits(0).length === 0) {
            campaignRestart('兵没了，这一关重开。');
            return true;
        }
        if (campaignWinMet()) {
            campaignPresentWin();
            return true;
        }
        return false;
    } finally {
        if (gameState && gameState.campaign) gameState.campaign._resolving = false;
    }
}

function campaignOnGameOver(winner) {
    if (!gameState.campaign) return false;
    if (winner && winner.id === 0) {
        campaignPresentWin();
        return true;
    }
    campaignRestart('这一关重开。');
    return true;
}

function campaignPunish(enemyId) {
    const level = campaignLevel();
    const spec = level && level.players[enemyId];
    if (!spec || spec.script !== 'punish') return;

    const idle = campaignUnits(0).filter(unit => unit._couldAttack && !unit.hasActed && !unit.hasAttacked);
    if (idle.length === 0) return;
    const foes = campaignUnits(enemyId);
    if (foes.length === 0) return;

    const target = idle[0];
    attackTarget(foes[0].x, foes[0].y, target.x, target.y);
    const stillThere = campaignUnits(0).some(unit => unit.id === target.id);
    if (!stillThere) gameState.campaign.soldierDown = true;
}

function campaignRunScriptedTurns() {
    let guard = 0;
    while (guard < 6) {
        guard += 1;
        const current = gameState.players[gameState.currentPlayerIndex];
        if (!current || !current.isAI || !current.campaignScript || gameState.isGameOver) break;
        campaignPunish(current.id);
        if (campaignResolve()) return;
        processEndOfTurn();
    }
}
