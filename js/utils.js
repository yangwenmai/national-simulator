// 工具函数
let notificationTimeout = null;

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    
    // 设置通知颜色
    notification.style.backgroundColor = NOTIFICATION_TYPES[type].color;
    
    // 显示通知
    notification.classList.add('show');
    
    // 清除之前的定时器
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // 设置自动隐藏
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, NOTIFICATION_TYPES[type].duration);
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
function expandTerritory(x, y, playerId) {
    // 建筑周围的影响范围
    let radius = 1;
    
    // 词条：领土扩张 - 范围+1
    const player = gameState.players[playerId];
    if (player && player.enchantments && player.enchantments.includes('territoryExpand')) {
        radius = 2;
    }
    
    let expanded = false;
    
    // 遍历周围的格子
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            // 确保在地图范围内
            if (isWithinMapBounds(nx, ny)) {
                const tile = getTileAt(gameState.map, nx, ny);
                
                // 只占领没有所有者的格子
                if (tile && tile.ownerId === null) {
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
    
    return expanded;
} 