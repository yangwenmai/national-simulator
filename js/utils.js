// 工具函数
let notificationTimeout = null;

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    
    const noteCfg = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;
    notification.style.backgroundColor = noteCfg.color;
    
    // 显示通知
    notification.classList.add('show');
    
    // 清除之前的定时器
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // 设置自动隐藏
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, noteCfg.duration);
}

// 添加游戏日志条目
function addLogEntry(text) {
    const logContainer = document.getElementById('game-log');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    // 添加时间戳
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    logEntry.textContent = `[${timestamp}] ${text}`;
    
    // 添加到顶部
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // 添加高亮效果
    logEntry.classList.add('highlight');
}

// 生成随机ID
function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
}

// 生成建筑ID
function generateBuildingId() {
    return 'b_' + generateUniqueId();
}

// 生成单位ID
function generateUnitId() {
    return 'u_' + generateUniqueId();
}

// 获取表示玩家颜色的样式字符串
function getPlayerColorStyle(player) {
    return `color: ${player.color.main}; font-weight: bold;`;
}

// 解析玩家标记文本，例如 [player]玩家1[/player]
function parsePlayerMarkup(text, players) {
    const regex = /\[player\](.*?)\[\/player\]/g;
    return text.replace(regex, (match, playerName) => {
        const player = players.find(p => p.name === playerName);
        if (player) {
            return `<span style="${getPlayerColorStyle(player)}">${playerName}</span>`;
        }
        return playerName;
    });
}

// 计算两点之间的曼哈顿距离
function manhattanDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// 延迟执行函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 在指定范围内生成随机整数
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 显示元素
function showElement(element) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.style.display = '';
    }
}

// 隐藏元素
function hideElement(element) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.style.display = 'none';
    }
}

// 切换Tab
function openTab(tabId) {
    // 隐藏所有标签内容
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    // 取消所有标签按钮的活动状态
    const tabs = document.getElementsByClassName('tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    
    // 显示选中的标签内容
    document.getElementById(tabId).classList.add('active');
    
    // 激活对应的标签按钮
    const clickedTab = document.querySelector(`.tab[onclick="openTab('${tabId}')"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
}

// 扩张领土
// options.fixedRadius：若指定则使用该半径（领地扩张器固定 3×3），且不受「领土扩张」词条影响
function expandTerritory(x, y, playerId, options) {
    options = options || {};
    let radius = 1;

    if (options.fixedRadius != null) {
        radius = options.fixedRadius;
    } else {
        const player = gameState.players[playerId];
        if (player && player.enchantments && player.enchantments.includes('territoryExpand')) {
            radius = 2;
        }
    }
    
    let expanded = false;
    const claimedCells = [];
    
    // 遍历周围的格子
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            // 确保在地图范围内
            if (isWithinMapBounds(nx, ny)) {
                const tile = getTileAt(gameState.map, nx, ny);
                
                // 只占领没有所有者的格子；海盗船所在水域永不因扩张变为领地
                if (tile && tile.ownerId === null) {
                    if (tile.building && tile.building.type === 'pirateShip') continue;
                    claimedCells.push({ x: nx, y: ny });
                    tile.ownerId = playerId;
                    
                    // 设置初始领土控制值
                    if (tile.territoryControl === undefined) {
                        tile.territoryControl = gameState.territoryControlMax || 100;
                    }
                    
                    expanded = true;
                }
            }
        }
    }
    
    // 如果领土扩张了，更新UI和地图
    if (expanded) {
        updateGameStateDisplay();
        drawMap();
    }
    
    return { expanded, claimedCells };
}

// 领地扩张器被拆除或摧毁时：收回其当时圈下的无主格（仍为该玩家领地的才清除）
function revertTerritoryExpanderClaims(centerX, centerY, claimedCells, playerId) {
    let cells = claimedCells;
    if (!cells || cells.length === 0) {
        const r = BUILDINGS.territoryExpander && BUILDINGS.territoryExpander.fixedTerritoryRadius != null
            ? BUILDINGS.territoryExpander.fixedTerritoryRadius
            : 1;
        cells = [];
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const nx = centerX + dx;
                const ny = centerY + dy;
                if (isWithinMapBounds(nx, ny)) {
                    cells.push({ x: nx, y: ny });
                }
            }
        }
    }
    let reverted = false;
    for (const c of cells) {
        const tile = getTileAt(gameState.map, c.x, c.y);
        if (!tile || tile.ownerId !== playerId) continue;
        const isCenter = c.x === centerX && c.y === centerY;
        // 中心格已拆掉扩张器；外圈若后来建了建筑或站着单位，则不收回该格以免悬空逻辑
        if (!isCenter && (tile.building || tile.unit)) continue;
        tile.ownerId = null;
        reverted = true;
    }
    if (reverted) {
        updateGameStateDisplay();
        drawMap();
    }
}

/** 建筑类型对应的最大生命（用于扣血、迁都继承等） */
function getBuildingMaxHealthForType(buildingType) {
    if (buildingType === 'capital') return BUILDINGS.capital.maxHealth;
    if (BUILDINGS[buildingType]) return BUILDINGS[buildingType].maxHealth;
    return 200;
}

/**
 * 扣血前将 building.health 规范为有限值；缺失或非数字时视为满血。
 * 避免 undefined/NaN 导致迁都时 `health || max` 误判为满血 350。
 */
function ensureFiniteBuildingHealthBeforeDamage(building) {
    if (!building || !building.type) return;
    const maxH = getBuildingMaxHealthForType(building.type);
    const h = building.health;
    if (typeof h !== 'number' || !Number.isFinite(h)) {
        building.health = maxH;
    } else {
        building.health = Math.min(maxH, Math.max(0, h));
    }
}

/**
 * 摧毁敌方首都后，由玩家单位/导弹等造成的最后一击方获得战利品：
 * 增加与其当时持有金币等额的金币（即当前金币的 +100%）。
 */
function grantCapitalDestructionGoldBonus(beneficiaryPlayerId) {
    if (beneficiaryPlayerId == null || beneficiaryPlayerId < 0) return;
    const p = gameState.players[beneficiaryPlayerId];
    if (!p || p.isDefeated) return;
    const bonus = Math.max(0, Math.floor(Number(p.gold)) || 0);
    if (bonus <= 0) {
        addLogEntry(`${p.name}摧毁敌方首都，因当前金币为 0，未获得额外金币战利品。`);
        return;
    }
    p.gold += bonus;
    addLogEntry(
        `${p.name}摧毁敌方首都！战利品为当时持有金币的 100%（+${bonus}），现持有 ${p.gold} 金币。`
    );
    showNotification(`摧毁首都！获得 ${bonus} 金币（与当时持有量等额）`, 'success');
}