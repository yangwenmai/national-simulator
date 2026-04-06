// 用户界面相关功能

// 定义变量，用于引用combat.js中的函数
let calculateInstructorAttackRef;

// 本地实现calculateInstructorAttack函数作为备选
function calculateInstructorAttackLocal(instructor) {
    if (!instructor || !instructor.x || !instructor.y) return 0;
    
    const x = instructor.x;
    const y = instructor.y;
    let totalAttack = 0;
    let unitsCount = 0;
    
    // 只检查四个相邻方向
    const adjacentCoords = [
        {x: x, y: y-1}, // 上
        {x: x+1, y: y}, // 右
        {x: x, y: y+1}, // 下
        {x: x-1, y: y}  // 左
    ];
    
    // 遍历四个相邻方向
    for (const coord of adjacentCoords) {
        // 确保在地图范围内
        if (coord.x >= 0 && coord.x < GRID_WIDTH && coord.y >= 0 && coord.y < GRID_HEIGHT) {
            const tileIndex = coord.y * GRID_WIDTH + coord.x;
            const tile = gameState.map[tileIndex];
            
            if (tile.unit && tile.unit.type !== 'instructor') {
                const unitAttack = UNITS[tile.unit.type].attack;
                totalAttack += Math.floor(unitAttack / 2); // 取一半攻击力
                unitsCount++;
                
                // 最多只取3个单位
                if (unitsCount >= 3) break;
            }
        }
    }
    
    return totalAttack;
}

// 全局变量，用于跟踪反馈弹窗状态
let feedbackContainerVisible = false;
let feedbackContainer = null;

// 初始化界面事件
function initUI() {
    // 设置函数引用，确保在页面加载后可用
    calculateInstructorAttackRef = window.calculateInstructorAttack || calculateInstructorAttackLocal;
    
    // 添加画布点击事件（含拖拽检测）
    canvas.addEventListener('mousedown', trackMouseDown);
    canvas.addEventListener('click', handleCanvasClick);
    
    // 添加画布悬浮提示
    canvas.addEventListener('mousemove', handleCanvasHover);
    canvas.addEventListener('mouseleave', hideMapTooltip);
    
    // 添加按钮事件
    document.getElementById('end-turn-btn').addEventListener('click', endTurn);
    document.getElementById('cancel-action-btn').addEventListener('click', cancelCurrentAction);
    document.getElementById('new-game-btn').addEventListener('click', showPlayerCountDialog);
    document.getElementById('attack-btn').addEventListener('click', startAttackMode);
    document.getElementById('move-btn').addEventListener('click', startMoveMode);
    
    // 初始化反馈按钮
    const feedbackBtn = document.getElementById('float-feedback-btn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', showFeedbackForm);
    }
    
    // 刷新游戏状态显示与按钮说明系统
    updateGameStateDisplay();
    initControlHelpSystem();
}

// updateResourceDisplay是updatePlayerStats的别名，用于在更新玩家收入后刷新资源显示
function updateResourceDisplay() {
    updatePlayerStats();
}

// 更新游戏状态显示
function updateGameStateDisplay() {
    // 更新回合显示
    const turnDisplay = document.getElementById('turn-display');
    if (gameState.isGameOver) {
        turnDisplay.textContent = `游戏结束！${gameState.winner.name}获得了胜利！`;
    } else {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        // 计算游戏总时长
        const totalGameTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
        const hours = Math.floor(totalGameTime / 3600);
        const minutes = Math.floor((totalGameTime % 3600) / 60);
        const seconds = totalGameTime % 60;
        const gameTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 格式化当前玩家回合用时
        const currentTurnTime = Math.floor((Date.now() - gameState.currentTurnStartTime) / 1000);
        const turnMins = Math.floor(currentTurnTime / 60);
        const turnSecs = currentTurnTime % 60;
        const turnTimeStr = `${turnMins.toString().padStart(2, '0')}:${turnSecs.toString().padStart(2, '0')}`;
        
        // 更新回合显示，包含玩家信息和时间信息，并使当前玩家更加突出
        const aiTag = currentPlayer.isAI ? ' <span style="font-size:11px;background:#e67e22;color:#fff;padding:1px 6px;border-radius:8px;margin-left:4px;">🤖 电脑</span>' : '';
        turnDisplay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span style="font-weight: bold;">回合：${gameState.turn}</span>
                <span>游戏时长：${gameTimeStr}</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background-color: ${currentPlayer.color.light}; padding: 5px; border-radius: 4px; border: 2px solid ${currentPlayer.color.main};">
                <div style="display: flex; align-items: center;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${currentPlayer.color.main}; margin-right: 5px;"></span>
                    <span style="font-weight: bold; color: ${currentPlayer.color.dark}; font-size: 16px;">${currentPlayer.name}的回合${aiTag}</span>
                </div>
                <div style="width: 80px; text-align: right;">用时：<span id="current-turn-time">${turnTimeStr}</span></div>
            </div>
        `;
    }
    
    // 更新玩家状态
    updatePlayerStats();
    
    // 更新选中信息
    updateSelectionInfo();
    
    // 更新建筑选项
    updateBuildingOptions();
    
    // 更新军事单位选项
    updateMilitaryOptions();
    
    // 更新词条选项
    updateEnchantmentOptions();
    
    // 设置定时更新计时器显示
    if (!gameState.isGameOver && !gameState._timerInterval) {
        gameState._timerInterval = setInterval(() => {
            if (!gameState.isGameOver) {
                updateTurnTimer();
            } else {
                clearInterval(gameState._timerInterval);
                gameState._timerInterval = null;
            }
        }, 1000);
    }
}

// 只更新计时器显示，不更新其他UI元素，减少性能开销
function updateTurnTimer() {
    if (gameState.isGameOver) return;
    
    // 计算游戏总时长
    const totalGameTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
    const hours = Math.floor(totalGameTime / 3600);
    const minutes = Math.floor((totalGameTime % 3600) / 60);
    const seconds = totalGameTime % 60;
    const gameTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // 格式化当前玩家回合用时
    const currentTurnTime = Math.floor((Date.now() - gameState.currentTurnStartTime) / 1000);
    const turnMins = Math.floor(currentTurnTime / 60);
    const turnSecs = currentTurnTime % 60;
    const turnTimeStr = `${turnMins.toString().padStart(2, '0')}:${turnSecs.toString().padStart(2, '0')}`;
    
    // 更新时间显示 - 只更新数字部分，避免文本闪烁
    const timeSpan = document.getElementById('current-turn-time');
    if (timeSpan) {
        timeSpan.textContent = turnTimeStr;
    }
    
    // 更新游戏总时长
    const turnDisplay = document.getElementById('turn-display');
    if (turnDisplay) {
        const divs = turnDisplay.querySelectorAll('div');
        if (divs.length >= 1) {
            const spans = divs[0].querySelectorAll('span');
            if (spans.length >= 2) {
                spans[1].textContent = `游戏时长：${gameTimeStr}`;
            }
        }
    }
}

// 更新玩家状态显示
function updatePlayerStats() {
    const statsContainer = document.getElementById('player-stats');
    statsContainer.innerHTML = '';
    
    for (let i = 0; i < gameState.players.length; i++) {
        const player = gameState.players[i];
        
        // 跳过已被击败的玩家
        if (player.isDefeated) continue;
        
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        // 当前玩家样式增强
        const isCurrentPlayer = (i === gameState.currentPlayerIndex);
        if (isCurrentPlayer) {
            playerCard.classList.add('active');
            playerCard.style.transform = 'scale(1.05)';
            playerCard.style.boxShadow = `0 0 10px ${player.color.main}, 0 0 5px ${player.color.dark}`;
            playerCard.style.position = 'relative';
            playerCard.style.zIndex = '10';
        }
        
        // 设置玩家卡片背景
        playerCard.style.backgroundColor = `${player.color.light}`;
        playerCard.style.borderColor = `${player.color.main}`;
        playerCard.style.borderWidth = isCurrentPlayer ? '3px' : '1px';
        
        // 添加"当前回合"标识
        if (isCurrentPlayer) {
            const currentTurnBadge = document.createElement('div');
            currentTurnBadge.style.position = 'absolute';
            currentTurnBadge.style.top = '-10px';
            currentTurnBadge.style.right = '-10px';
            currentTurnBadge.style.backgroundColor = player.color.main;
            currentTurnBadge.style.color = 'white';
            currentTurnBadge.style.padding = '2px 6px';
            currentTurnBadge.style.borderRadius = '10px';
            currentTurnBadge.style.fontSize = '11px';
            currentTurnBadge.style.fontWeight = 'bold';
            currentTurnBadge.textContent = '当前回合';
            playerCard.appendChild(currentTurnBadge);
        }
        
        const playerName = document.createElement('h4');
        playerName.textContent = player.name;
        playerName.style.color = player.color.dark;
        playerName.style.margin = '0 0 5px 0';
        playerName.style.fontSize = isCurrentPlayer ? '16px' : '14px';
        
        // 显示玩家累计用时
        const playerTimeInfo = document.createElement('div');
        playerTimeInfo.style.fontSize = '11px';
        playerTimeInfo.style.marginBottom = '3px';
        
        // 计算玩家累计用时，注意：当前玩家的累计用时需要加上当前进行中的回合时间
        let totalTimeMs = player.totalTurnTime;
        if (i === gameState.currentPlayerIndex) {
            totalTimeMs += (Date.now() - gameState.currentTurnStartTime);
        }
        
        const totalTimeSec = Math.floor(totalTimeMs / 1000);
        const mins = Math.floor(totalTimeSec / 60);
        const secs = totalTimeSec % 60;
        playerTimeInfo.textContent = `累计用时: ${mins}分${secs}秒`;
        
        const playerResources = document.createElement('div');
        playerResources.className = 'player-resources';
        
        // 显示金币
        const goldResource = document.createElement('div');
        goldResource.className = 'resource';
        
        const goldIcon = document.createElement('span');
        goldIcon.className = 'resource-icon';
        goldIcon.style.backgroundColor = '#f39c12';
        goldIcon.textContent = '¥';
        
        const goldValue = document.createElement('span');
        goldValue.textContent = player.gold;
        
        goldResource.appendChild(goldIcon);
        goldResource.appendChild(goldValue);
        
        // 显示收入
        const incomeResource = document.createElement('div');
        incomeResource.className = 'resource';
        
        const incomeIcon = document.createElement('span');
        incomeIcon.className = 'resource-icon';
        incomeIcon.style.backgroundColor = '#27ae60';
        incomeIcon.textContent = '+';
        
        const incomeValue = document.createElement('span');
        incomeValue.textContent = `${player.income}/回合`;
        
        incomeResource.appendChild(incomeIcon);
        incomeResource.appendChild(incomeValue);
        
        // 添加到资源容器
        playerResources.appendChild(goldResource);
        playerResources.appendChild(incomeResource);
        
        // 组装卡片
        playerCard.appendChild(playerName);
        playerCard.appendChild(playerTimeInfo);
        playerCard.appendChild(playerResources);
        
        // 添加到状态容器
        statsContainer.appendChild(playerCard);
    }
}

// 是否存在可招募医生的医院格（己方、无单位、本回合该医院未招过医生）
function playerHasDoctorRecruitSlot(player) {
    const used = gameState.factoryProduction.hospitalDoctorRecruitKeys || [];
    for (let i = 0; i < gameState.map.length; i++) {
        const t = gameState.map[i];
        if (t.ownerId !== player.id || !t.building) continue;
        if (t.building.type !== 'hospital' && t.building.type !== 'bigHospital') continue;
        if (t.unit) continue;
        const key = `${t.x},${t.y}`;
        if (used.includes(key)) continue;
        return true;
    }
    return false;
}

function syncMilitaryActionButtons() {
    const attackBtn = document.getElementById('attack-btn');
    const moveBtn = document.getElementById('move-btn');
    if (!attackBtn || !moveBtn) return;
    
    moveBtn.dataset.helpShort = '移动己方单位：进入移动模式后，点选蓝色高亮内的空地（受地形、建筑、他人单位限制）。';
    moveBtn.dataset.helpLong = '请先在地图上选中一枚己方单位。点击「移动」后，地图标出可达范围；再点目标格完成移动。拥有「城市」时，本回合通常还可再攻击或治疗。油车、水域等有额外规则。';
    
    const u = gameState.selectedUnit;
    if (!u || u.ownerId !== gameState.currentPlayerIndex) {
        attackBtn.textContent = '攻击';
        moveBtn.disabled = false;
        attackBtn.disabled = false;
        attackBtn.dataset.helpShort = '攻击：选中己方单位后使用，对敌方单位或建筑造成伤害（医生显示为「治疗」）。';
        attackBtn.dataset.helpLong = '先在地图上点选己方军事单位，再点本按钮。进入模式后红色区域为普攻/射程；点合法敌方目标。医生为绿色治疗范围，点受伤友军。海盗船等部分建筑己方也可摧毁。';
        return;
    }
    
    const def = UNITS[u.type];
    const isHealer = def && def.isHealer;
    attackBtn.textContent = isHealer ? '治疗' : '攻击';
    
    if (isHealer) {
        attackBtn.dataset.helpShort = '治疗友军：绿圈内点选受伤的己方军事单位，每回合一次。';
        attackBtn.dataset.helpLong = '医生无法攻击敌人。进入后在治疗距离内点击己方受伤单位恢复生命（具体数值见单位说明）。与「城市」效果叠加时，可先移动再治疗。';
    } else {
        attackBtn.dataset.helpShort = '攻击敌人：在攻击/射程高亮内点选敌方单位或建筑。';
        attackBtn.dataset.helpLong = '进入攻击模式后，点选范围内的敌方单位或建筑（首都、导弹工厂等）。不同兵种射程不同；轰炸机、火炮可远程。不能直接打己方普通建筑。';
    }
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const hasCity = playerHasCity(currentPlayer);
    if (hasCity) {
        moveBtn.disabled = !!u.hasMoved;
        attackBtn.disabled = !!u.hasAttacked;
    } else {
        const done = !!u.hasActed;
        moveBtn.disabled = done;
        attackBtn.disabled = done;
    }
}

// ---------- 界面按钮说明（悬停右侧提示条 + Alt+点击弹出详解）----------
const UI_HELP_DEFAULT =
    '💡 把鼠标移到任意按钮或左侧列表项上，这里会说明能做什么。按住 Alt 再点按钮可看更长说明（不会执行该操作）。';

function setGlobalUiHelp(text) {
    const el = document.getElementById('global-ui-help');
    if (el) el.textContent = text || UI_HELP_DEFAULT;
}

function resetGlobalUiHelp() {
    setGlobalUiHelp(UI_HELP_DEFAULT);
}

function bindHoverHelp(el, shortText, longText) {
    if (!el || el.dataset.hoverHelpBound === '1') return;
    el.dataset.hoverHelpBound = '1';
    if (longText) el.title = shortText;
    el.addEventListener('mouseenter', () => setGlobalUiHelp(shortText));
    el.addEventListener('mouseleave', () => resetGlobalUiHelp());
    el.addEventListener('focus', () => setGlobalUiHelp(shortText));
    el.addEventListener('blur', () => resetGlobalUiHelp());
    if (longText) {
        el.addEventListener(
            'click',
            e => {
                if (!e.altKey) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                showNotification(longText, 'help');
            },
            true
        );
    }
}

function bindDatasetHoverHelp(el) {
    if (!el || el.dataset.uiHelpBound) return;
    el.dataset.uiHelpBound = '1';
    el.addEventListener('mouseenter', () => {
        const s = el.getAttribute('data-help-short');
        if (s) setGlobalUiHelp(s);
    });
    el.addEventListener('mouseleave', () => resetGlobalUiHelp());
    el.addEventListener('focus', () => {
        const s = el.getAttribute('data-help-short');
        if (s) setGlobalUiHelp(s);
    });
    el.addEventListener('blur', () => resetGlobalUiHelp());
    el.addEventListener(
        'click',
        e => {
            if (!e.altKey) return;
            const longT = el.getAttribute('data-help-long');
            if (!longT) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            showNotification(longT, 'help');
        },
        true
    );
}

function initControlHelpSystem() {
    resetGlobalUiHelp();

    bindHoverHelp(
        document.getElementById('end-turn-btn'),
        '结束回合：结算本回合建造进度、医院、防御塔、海盗等，然后轮到下一个玩家。',
        '点击后立即结束当前玩家回合。会推进建筑队列、医院治疗、塔防、油车、海盗移动与攻击、导弹工厂等阶段，再切换行动方并发放下家回合收入。未用完的行动机会将作废。'
    );
    bindHoverHelp(
        document.getElementById('cancel-action-btn'),
        '取消当前模式：退出建造、移动、攻击/治疗、招募、修建筑或导弹瞄准。',
        '正在建造选址、移动、攻击、招募单位、修理建筑或瞄准导弹时，点此恢复普通选格状态，不扣资源。'
    );
    bindHoverHelp(
        document.getElementById('new-game-btn'),
        '新游戏：选择人数、是否电脑、地图大小并开始一局。',
        '打开设置面板，可配置 2～5 人、哪些席位为 AI、地图尺寸。确认后会重置地图与资源；当前对局进度将丢失。'
    );

    bindDatasetHoverHelp(document.getElementById('attack-btn'));
    bindDatasetHoverHelp(document.getElementById('move-btn'));

    bindHoverHelp(
        document.getElementById('view-fit-btn'),
        '适应窗口：缩放地图以在窗口内看全图。',
        '按画布可用高度自动缩放格子，适合总览形势；卷动条会关闭，地图居中显示。'
    );
    bindHoverHelp(
        document.getElementById('view-scroll-btn'),
        '原始大小：一格一格原始像素，可拖拽卷动看大地图。',
        '以固定像素尺寸绘制格子，大地图会出现滚动条，可按住画布区域拖拽平移。'
    );

    document.querySelectorAll('#left-panel .tabs .tab').forEach(tab => {
        if (tab.dataset.helpTabBound === '1') return;
        tab.dataset.helpTabBound = '1';
        const label = (tab.textContent || '').trim();
        let shortT = '';
        let longT = '';
        if (label === '建造') {
            shortT = '建造页：选建筑类型，再在己方地图绿格上放置（扣金、多回合完工）。';
            longT = '列出经济、军事、防御等建筑。点选一种后进入建造模式，可放置格会高亮；多数需在自己领土上；经济类中有「领地扩张器」可建无主陆地（琥珀高亮）；矿场要山地、海盗船要无主水域。部分建筑唯一或需前置。';
        } else if (label === '军事') {
            shortT = '军事页：招募单位，再在地图高亮格上生成（医生仅医院格）。';
            longT = '按兵种分类，需先有兵营/工厂/医院等前提。点击单位后进入招募模式，蓝色或绿色标出可放置格；每回合各工厂有招募上限。';
        } else if (label === '词条') {
            shortT = '词条页：拥有魔法学院时可花金币购买全局被动强化。';
            longT = '每条为一次性购买、全局生效的加成（如攻击、收入、建造加速）。需先建造魔法学院才会出现可买列表；已拥有会标明。';
        }
        if (shortT) {
            tab.title = shortT;
            tab.addEventListener('mouseenter', () => setGlobalUiHelp(shortT));
            tab.addEventListener('mouseleave', () => resetGlobalUiHelp());
            tab.addEventListener('click', e => {
                if (!e.altKey) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                showNotification(longT, 'help');
            }, true);
        }
    });

    const fb = document.getElementById('float-feedback-btn');
    if (fb) {
        bindHoverHelp(
            fb,
            '支持开发者：打赏/联系方式（微信、Twitter 等）。',
            '打开小窗口，可选微信、Twitter 或 Coffee 等方式联系或支持作者。'
        );
    }

    syncMilitaryActionButtons();
}

// 更新选中信息
function updateSelectionInfo() {
    const infoContainer = document.getElementById('selection-info');
    infoContainer.innerHTML = '';
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 如果有选中的格子
    if (gameState.selectedTile) {
        const tile = gameState.selectedTile;
        const tileIndex = tile.y * GRID_WIDTH + tile.x;
        const mapTile = gameState.map[tileIndex];
        
        // 添加坐标信息
        const coordInfo = document.createElement('p');
        coordInfo.textContent = `坐标: (${tile.x}, ${tile.y})`;
        infoContainer.appendChild(coordInfo);
        
        // 添加地形信息
        const terrainInfo = document.createElement('p');
        terrainInfo.textContent = `地形: ${getTerrainName(mapTile.terrain)}`;
        infoContainer.appendChild(terrainInfo);
        
        // 如果有所有者
        if (mapTile.ownerId !== null) {
            const ownerInfo = document.createElement('p');
            const owner = gameState.players[mapTile.ownerId];
            ownerInfo.textContent = `所有者: ${owner.name}`;
            ownerInfo.style.color = owner.color.main;
            infoContainer.appendChild(ownerInfo);
        }
        
        // 如果有建筑
        if (mapTile.building) {
            const building = mapTile.building;
            const buildingInfo = document.createElement('div');
            buildingInfo.innerHTML = `<strong>${building.name}</strong>`;
            
            // 显示健康状态
            const healthInfo = document.createElement('p');
            let maxHealth;
            if (building.type === 'capital') {
                maxHealth = BUILDINGS.capital.maxHealth;
            } else if (BUILDINGS[building.type]) {
                maxHealth = BUILDINGS[building.type].maxHealth;
            } else {
                maxHealth = 200;
            }
            
            // 确保健康值不为负数，并计算正确的百分比
            const currentHealth = Math.max(0, building.health);
            const healthPercent = Math.max(0, Math.min(100, Math.round((currentHealth / maxHealth) * 100)));
            
            healthInfo.textContent = `健康: ${currentHealth}/${maxHealth} (${healthPercent}%)`;
            
            buildingInfo.appendChild(healthInfo);
            
            if (building.type === 'pirateShip' && building.placedByPlayerId != null) {
                const builder = gameState.players[building.placedByPlayerId];
                const psNote = document.createElement('p');
                psNote.textContent = `建造者: ${builder.name} · 此格水域不作为任何玩家领地`;
                psNote.style.fontSize = '12px';
                psNote.style.color = '#7f8c8d';
                buildingInfo.appendChild(psNote);
            }
            
            // 如果有收入，显示收入
            if (building.type && BUILDINGS[building.type] && 
                (BUILDINGS[building.type].income > 0 || BUILDINGS[building.type].randomIncome)) {
                const incomeInfo = document.createElement('p');
                if (building.type === 'tradingPost' && BUILDINGS.tradingPost.randomIncome) {
                    const { min, max } = BUILDINGS.tradingPost.randomIncome;
                    const lastIncome = building.lastRandomIncome || '?';
                    incomeInfo.textContent = `收入: ${min}~${max}/回合 (上回合: ${lastIncome})`;
                } else if (building.type === 'city' && BUILDINGS.city.randomIncome) {
                    const { min, max } = BUILDINGS.city.randomIncome;
                    const lastIncome = building.lastRandomIncome !== undefined ? building.lastRandomIncome : '?';
                    incomeInfo.textContent = `收入: ${min}~${max}/回合 (上回合: ${lastIncome})`;
                    if (building.isCityPart) {
                        incomeInfo.textContent += ' (副格)';
                    }
                } else {
                    const actualIncome = building.adjustedIncome !== undefined ? building.adjustedIncome : (building.income || BUILDINGS[building.type].income);
                    incomeInfo.textContent = `收入: ${actualIncome}/回合`;
                }
                buildingInfo.appendChild(incomeInfo);
            }
            
            // 显示战斗信息
            if (building.type && BUILDINGS[building.type] && BUILDINGS[building.type].combatNotes) {
                const combatInfo = document.createElement('p');
                combatInfo.textContent = `⚔️ ${BUILDINGS[building.type].combatNotes}`;
                combatInfo.style.color = '#e74c3c'; // 红色显示战斗信息
                combatInfo.style.fontSize = '12px';
                combatInfo.style.fontStyle = 'italic';
                buildingInfo.appendChild(combatInfo);
            }
            
            // 如果是当前玩家的建筑且受损，显示修理按钮（需要修理厂）
            if (getTileBuildingOwnerId(mapTile) === gameState.currentPlayerIndex && healthPercent < 100) {
                const hasShop = playerHasRepairShop(currentPlayer);
                const healthPercentLost = 1 - (building.health / maxHealth);
                const repairCost = getRepairCost(building.type, healthPercentLost);
                
                if (hasShop) {
                    const repairButton = document.createElement('button');
                    repairButton.textContent = `修理 (¥${repairCost})`;
                    repairButton.disabled = currentPlayer.gold < repairCost;
                    
                    repairButton.addEventListener('click', () => {
                        repairBuilding(tile.x, tile.y);
                        updateSelectionInfo();
                    });
                    
                    buildingInfo.appendChild(repairButton);
                } else {
                    const hint = document.createElement('p');
                    hint.textContent = `⚠️ 需要修理厂才能修理（费用 ¥${repairCost}）`;
                    hint.style.color = '#e67e22';
                    hint.style.fontSize = '12px';
                    hint.style.margin = '4px 0';
                    buildingInfo.appendChild(hint);
                }
            }
            
            // 如果是导弹工厂，显示导弹工厂专属面板
            if (building.type === 'missileFactory' && getTileBuildingOwnerId(mapTile) === gameState.currentPlayerIndex) {
                const missilePanel = document.createElement('div');
                missilePanel.style.marginTop = '8px';
                missilePanel.style.padding = '8px';
                missilePanel.style.backgroundColor = '#f5f5f5';
                missilePanel.style.borderRadius = '4px';
                missilePanel.style.border = '1px solid #ddd';
                
                const stored = building.storedMissiles || 0;
                const maxM = BUILDINGS.missileFactory.maxMissiles;
                
                const missileInfo = document.createElement('p');
                missileInfo.innerHTML = `<strong>导弹库存:</strong> ${stored}/${maxM}`;
                missilePanel.appendChild(missileInfo);
                
                if (building.missileBuilding) {
                    const prodInfo = document.createElement('p');
                    prodInfo.textContent = `建造中... 剩余${building.missileBuildTurns}回合`;
                    prodInfo.style.color = '#f39c12';
                    prodInfo.style.fontSize = '12px';
                    missilePanel.appendChild(prodInfo);
                }
                
                // 建造导弹按钮
                if (!building.missileBuilding && stored < maxM) {
                    const buildBtn = document.createElement('button');
                    const missileCost = BUILDINGS.missileFactory.missileCost;
                    buildBtn.textContent = `建造导弹 (¥${missileCost})`;
                    buildBtn.style.backgroundColor = '#e67e22';
                    buildBtn.disabled = currentPlayer.gold < missileCost;
                    
                    buildBtn.addEventListener('click', () => {
                        startMissileBuild(mapTile);
                        updateSelectionInfo();
                    });
                    missilePanel.appendChild(buildBtn);
                }
                
                // 发射导弹按钮
                if (stored > 0) {
                    const launchBtn = document.createElement('button');
                    launchBtn.textContent = `发射导弹 (库存${stored}枚)`;
                    launchBtn.style.backgroundColor = '#e74c3c';
                    launchBtn.style.marginTop = '4px';
                    
                    launchBtn.addEventListener('click', () => {
                        gameState.missileMode = true;
                        gameState.selectedMissileFactory = mapTile;
                        showElement('cancel-action-btn');
                        showNotification('点击地图上的任意位置发射导弹！', 'info');
                        highlightMissileRange();
                    });
                    missilePanel.appendChild(launchBtn);
                }
                
                buildingInfo.appendChild(missilePanel);
            }
            
            // 首都：紧急迁都（需至少一座城市）
            if (
                building.type === 'capital' &&
                getTileBuildingOwnerId(mapTile) === gameState.currentPlayerIndex
            ) {
                const cities = getCityPositions(currentPlayer);
                const relocateWrap = document.createElement('div');
                relocateWrap.style.marginTop = '8px';
                relocateWrap.style.padding = '8px';
                relocateWrap.style.backgroundColor = '#fdf6e3';
                relocateWrap.style.borderRadius = '6px';
                relocateWrap.style.border = '1px solid #e6d7a2';
                const rTitle = document.createElement('p');
                rTitle.style.margin = '0 0 6px 0';
                rTitle.style.fontSize = '12px';
                rTitle.style.color = '#7d6608';
                rTitle.textContent =
                    '紧急迁都：把首都移到一座城市的锚点格（继承当前首都剩余生命；原首都与城市 2×2 清空）。';
                relocateWrap.appendChild(rTitle);
                if (cities.length === 0) {
                    const h = document.createElement('p');
                    h.style.fontSize = '11px';
                    h.style.color = '#95a5a6';
                    h.style.margin = '0';
                    h.textContent = '你还没有城市，无法迁都（需先建造城市）。';
                    relocateWrap.appendChild(h);
                } else {
                    const sel = document.createElement('select');
                    sel.style.width = '100%';
                    sel.style.padding = '4px';
                    sel.style.marginBottom = '6px';
                    cities.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = `${p.x},${p.y}`;
                        opt.textContent = `城市锚点 (${p.x}, ${p.y})`;
                        sel.appendChild(opt);
                    });
                    const rBtn = document.createElement('button');
                    rBtn.textContent = '迁都至所选城市';
                    rBtn.style.backgroundColor = '#9b59b6';
                    rBtn.style.width = '100%';
                    rBtn.addEventListener('click', () => {
                        const [cx, cy] = sel.value.split(',').map(Number);
                        const msg =
                            '确定迁都？\n\n' +
                            '· 原首都格变为空地（领土仍归你）。\n' +
                            '· 所选城市 2×2 清空，在锚点出现新首都；不再享受「城市」移动+攻击效果。\n' +
                            '· 新首都生命 = 当前首都剩余生命（不超过上限）。\n' +
                            '· 目标 2×2 内不能有军事单位。';
                        if (confirm(msg) && relocateCapitalToCity(cx, cy)) {
                            gameState.selectedTile = null;
                            updateSelectionInfo();
                        }
                    });
                    relocateWrap.appendChild(sel);
                    relocateWrap.appendChild(rBtn);
                }
                buildingInfo.appendChild(relocateWrap);
            }
            
            // 城市：快捷迁都入口
            if (
                building.type === 'city' &&
                getTileBuildingOwnerId(mapTile) === gameState.currentPlayerIndex
            ) {
                const ax = building.isCityAnchor ? tile.x : building.cityAnchorX;
                const ay = building.isCityAnchor ? tile.y : building.cityAnchorY;
                const capPos = getCapitalPosition(currentPlayer);
                if (
                    capPos &&
                    getCityPositions(currentPlayer).length > 0 &&
                    (capPos.x !== ax || capPos.y !== ay)
                ) {
                    const cWrap = document.createElement('div');
                    cWrap.style.marginTop = '8px';
                    cWrap.style.padding = '8px';
                    cWrap.style.backgroundColor = '#eef2ff';
                    cWrap.style.borderRadius = '6px';
                    cWrap.style.border = '1px solid #c5cae9';
                    const cBtn = document.createElement('button');
                    cBtn.textContent = '将首都迁到本城（锚点）';
                    cBtn.style.backgroundColor = '#5c6bc0';
                    cBtn.style.width = '100%';
                    cBtn.addEventListener('click', () => {
                        const msg =
                            '将首都迁到这座城市？\n\n' +
                            '· 原首都格清空；本城 2×2 清空并在锚点建新首都。\n' +
                            '· 新首都生命继承现首都剩余值。\n' +
                            '· 城内及邻格 2×2 不可有单位。';
                        if (confirm(msg) && relocateCapitalToCity(ax, ay)) {
                            gameState.selectedTile = null;
                            updateSelectionInfo();
                        }
                    });
                    cWrap.appendChild(cBtn);
                    buildingInfo.appendChild(cWrap);
                }
            }
            
            // 如果是当前玩家的建筑（非首都），显示拆除按钮
            if (getTileBuildingOwnerId(mapTile) === gameState.currentPlayerIndex && building.type !== 'capital') {
                const demolishButton = document.createElement('button');
                const refund = Math.floor(BUILDINGS[building.type].cost * 0.5);
                demolishButton.textContent = `拆除 (返还¥${refund})`;
                demolishButton.style.backgroundColor = '#e74c3c';
                demolishButton.style.marginTop = '4px';
                
                demolishButton.addEventListener('click', () => {
                    const expanderNote =
                        building.type === 'territoryExpander'
                            ? ' 该扩张器当时圈下的领地将被收回（外圈若已建有建筑或站着单位则该格保留归属）。'
                            : '';
                    if (confirm(`确定要拆除${building.name}吗？将返还${refund}金币。${expanderNote}`)) {
                        demolishBuilding(tile.x, tile.y);
                        gameState.selectedTile = null;
                        updateSelectionInfo();
                    }
                });
                
                buildingInfo.appendChild(demolishButton);
            }
            
            infoContainer.appendChild(buildingInfo);
        }
        
        // 如果有单位
        if (mapTile.unit) {
            const unit = mapTile.unit;
            const unitType = UNITS[unit.type];
            
            const unitInfo = document.createElement('div');
            unitInfo.innerHTML = `<strong>${unitType.name}</strong>`;
            
            // 显示健康状态
            const healthInfo = document.createElement('p');
            const currentHealth = Math.max(0, isNaN(unit.health) ? 0 : unit.health);
            const unitMaxHP = unit.maxHealth || unitType.health;
            const healthPercent = Math.max(0, Math.min(100, Math.round((currentHealth / unitMaxHP) * 100)));
            
            healthInfo.textContent = `健康: ${currentHealth}/${unitMaxHP} (${healthPercent}%)`;
            if (unit.bonusMaxHealth > 0) {
                healthInfo.textContent += ` [+${unit.bonusMaxHealth}]`;
                healthInfo.style.color = '#e74c3c';
            }
            unitInfo.appendChild(healthInfo);
            
            // 显示攻击力和防御力
            const statsInfo = document.createElement('p');
            
            // 对于教官单位，重新计算当前的攻击力
            if (unit.type === 'instructor') {
                // 如果是教官单位，确保显示真实攻击力并提供清晰的来源说明
                // 重新计算教官的攻击力
                const actualAttack = calculateInstructorAttackRef(unit);
                
                // 找出周围的单位，用于显示详情
                const adjacentUnits = getAdjacentUnits(unit.x, unit.y);
                const boostedBy = [];
                
                for (const adjUnit of adjacentUnits) {
                    if (adjUnit.unit && adjUnit.unit.type !== 'instructor') {
                        const adjDef = UNITS[adjUnit.unit.type];
                        const unitName = adjDef.name;
                        const baseAttack = adjDef.attack;
                        const contributedAttack = Math.floor(baseAttack / 2);
                        const attackLabel =
                            adjDef.damagePercentOfTargetMaxHp != null
                                ? `${adjDef.damagePercentOfTargetMaxHp}%最大生命`
                                : baseAttack;
                        boostedBy.push({
                            name: unitName,
                            attack: attackLabel,
                            contributed: contributedAttack
                        });
                    }
                    
                    // 最多显示3个
                    if (boostedBy.length >= 3) break;
                }
                
                statsInfo.textContent = `攻击: ${actualAttack} | 防御: ${unitType.defense}`;
                statsInfo.style.color = actualAttack > 0 ? '#27ae60' : ''; // 如果攻击力大于0，使用绿色显示
                
                // 添加攻击力来源详情
                if (boostedBy.length > 0) {
                    const attackSourceInfo = document.createElement('div');
                    attackSourceInfo.style.fontSize = '11px';
                    attackSourceInfo.style.marginTop = '5px';
                    attackSourceInfo.style.color = '#e67e22';
                    
                    const sourceList = document.createElement('ul');
                    sourceList.style.margin = '5px 0 5px 20px';
                    sourceList.style.paddingLeft = '0';
                    
                    for (const source of boostedBy) {
                        const item = document.createElement('li');
                        item.textContent = `${source.name} (${source.attack}) → +${source.contributed}`;
                        sourceList.appendChild(item);
                    }
                    
                    attackSourceInfo.textContent = '攻击力来源:';
                    attackSourceInfo.appendChild(sourceList);
                    unitInfo.appendChild(attackSourceInfo);
                }
            } else if (unitType.damagePercentOfTargetMaxHp != null) {
                statsInfo.textContent = `攻击: 目标最大生命的${unitType.damagePercentOfTargetMaxHp}%（单次至少5） | 防御: ${unitType.defense}`;
            } else if (unit.tacticalGuidanceBoost) {
                // 战术指导加成的单位
                const baseAttack = unitType.attack;
                const boostedAttack = Math.floor(baseAttack * 1.15);
                statsInfo.textContent = `攻击: ${baseAttack} → ${boostedAttack} (+15%) | 防御: ${unitType.defense}`;
                statsInfo.style.color = '#27ae60'; // 绿色显示有加成的属性
            } else if (unit.type === 'bloodBerserker') {
                const actualAtk = unit.attack || unitType.attack;
                const bonusAtk = unit.bonusAttack || 0;
                statsInfo.textContent = `攻击: ${actualAtk}${bonusAtk > 0 ? ' [+' + bonusAtk + ']' : ''} | 防御: ${unitType.defense}`;
                if (bonusAtk > 0) statsInfo.style.color = '#e74c3c';
            } else if (unit.type === 'doctor') {
                statsInfo.textContent = `攻击: 无 | 防御: ${unitType.defense}`;
                statsInfo.style.color = '#27ae60';
            } else {
                statsInfo.textContent = `攻击: ${unitType.attack} | 防御: ${unitType.defense}`;
            }
            unitInfo.appendChild(statsInfo);
            
            // 显示移动范围和攻击范围
            const rangeInfo = document.createElement('p');
            if (unit.type === 'doctor') {
                rangeInfo.textContent = `移动范围: ${unitType.moveRange} | 治疗距离: ${unitType.healRange != null ? unitType.healRange : unitType.attackRange}（每回合1次，+${unitType.healAmount}生命）`;
            } else {
                rangeInfo.textContent = `移动范围: ${unitType.moveRange} | 攻击范围: ${unitType.attackRange}`;
            }
            unitInfo.appendChild(rangeInfo);
            
            // 显示战斗信息
            if (unitType.combatNotes) {
                const combatInfo = document.createElement('p');
                combatInfo.textContent = `⚔️ ${unitType.combatNotes}`;
                combatInfo.style.color = '#e74c3c'; // 红色显示战斗信息
                combatInfo.style.fontSize = '12px';
                combatInfo.style.fontStyle = 'italic';
                unitInfo.appendChild(combatInfo);
            }
            
            // 如果有特殊效果，显示特殊效果
            if (unit.tacticalGuidanceBoost) {
                const effectInfo = document.createElement('p');
                effectInfo.textContent = `特殊效果: 战术指导 (+15%攻击力)`;
                effectInfo.style.color = '#e67e22'; // 橙色显示特殊效果
                effectInfo.style.fontWeight = 'bold';
                unitInfo.appendChild(effectInfo);
            } else if (unit.type === 'instructor') {
                const effectInfo = document.createElement('p');
                effectInfo.textContent = `特殊效果: 复制我周围军事单位的一半攻击力`;
                effectInfo.style.color = '#e67e22'; // 橙色显示特殊效果
                unitInfo.appendChild(effectInfo);
            } else if (unit.type === 'commandUnit') {
                const effectInfo = document.createElement('p');
                effectInfo.textContent = `特殊效果: 指挥光环 (+20%攻击力和防御力)`;
                effectInfo.style.color = '#e67e22';
                unitInfo.appendChild(effectInfo);
            } else if (unit.type === 'bloodBerserker') {
                const kills = unit.totalKills || 0;
                const destroys = unit.totalDestroys || 0;
                const effectInfo = document.createElement('div');
                effectInfo.style.color = '#e74c3c';
                effectInfo.style.fontSize = '12px';
                effectInfo.style.marginTop = '4px';
                effectInfo.innerHTML = `
                    <strong>🔥 嗜血成长</strong><br>
                    <span style="opacity:0.95">仅本格亲自攻击击杀/拆建筑才叠加；塔、导弹不算。</span><br>
                    击杀单位: ${kills}次 (每次+5攻+10血)<br>
                    摧毁建筑: ${destroys}次 (每次+10攻+5血)<br>
                    累计成长: +${unit.bonusAttack || 0}攻击 +${unit.bonusMaxHealth || 0}生命
                `;
                unitInfo.appendChild(effectInfo);
            } else if (unit.type === 'doctor') {
                const effectInfo = document.createElement('p');
                effectInfo.textContent = `特殊效果: ${unitType.special ? unitType.special.effect : '治疗友军'}`;
                effectInfo.style.color = '#27ae60';
                unitInfo.appendChild(effectInfo);
            }
            
            // 如果是当前玩家的单位，显示行动状态
            if (unit.ownerId === gameState.currentPlayerIndex) {
                const actionInfo = document.createElement('p');
                const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                const hasCity = playerHasCity(currentPlayer);
                
                if (hasCity) {
                    const moveStatus = unit.hasMoved ? '已移动' : '可移动';
                    const attackStatus = unitType.isHealer
                        ? (unit.hasAttacked ? '已治疗' : '可治疗')
                        : (unit.hasAttacked ? '已攻击' : '可攻击');
                    actionInfo.textContent = `状态: ${moveStatus} / ${attackStatus}`;
                    if (!unit.hasMoved || !unit.hasAttacked) {
                        actionInfo.style.color = '#27ae60';
                    }
                } else {
                    actionInfo.textContent = unit.hasActed ? '状态: 已行动' : '状态: 可行动';
                }
                unitInfo.appendChild(actionInfo);
                
                // 判断单位是否还能行动
                let canStillAct = false;
                if (hasCity) {
                    canStillAct = !unit.hasMoved || !unit.hasAttacked;
                } else {
                    canStillAct = !unit.hasActed;
                }
                
                if (canStillAct) {
                    showElement('military-actions-panel');
                    gameState.selectedUnit = unit;
                } else {
                    hideElement('military-actions-panel');
                    gameState.selectedUnit = null;
                }
            } else {
                hideElement('military-actions-panel');
                gameState.selectedUnit = null;
            }
            
            infoContainer.appendChild(unitInfo);
        } else {
            hideElement('military-actions-panel');
            gameState.selectedUnit = null;
        }
    } else {
        infoContainer.textContent = '未选中任何格子';
        hideElement('military-actions-panel');
        gameState.selectedUnit = null;
    }
    
    syncMilitaryActionButtons();
}

// 获取指定位置周围的单位
function getAdjacentUnits(x, y) {
    const adjacentCoords = [
        {x: x, y: y-1}, // 上
        {x: x+1, y: y}, // 右
        {x: x, y: y+1}, // 下
        {x: x-1, y: y}  // 左
    ];
    
    const adjacentUnits = [];
    
    for (const coord of adjacentCoords) {
        if (coord.x >= 0 && coord.x < GRID_WIDTH && coord.y >= 0 && coord.y < GRID_HEIGHT) {
            const tileIndex = coord.y * GRID_WIDTH + coord.x;
            const tile = gameState.map[tileIndex];
            if (tile.unit) {
                adjacentUnits.push({
                    x: coord.x,
                    y: coord.y,
                    unit: tile.unit
                });
            }
        }
    }
    
    return adjacentUnits;
}

// 更新建筑选项
function updateBuildingOptions() {
    let buildingsPanel = document.getElementById('buildings-panel');
    
    // 如果元素不存在，则创建它
    if (!buildingsPanel) {
        buildingsPanel = document.createElement('div');
        buildingsPanel.id = 'buildings-panel';
        
        // 找到一个合适的父元素来附加这个面板
        const buildingTab = document.getElementById('building-tab');
        if (buildingTab) {
            // 检查是否已有building-options元素
            const buildingOptions = document.getElementById('building-options');
            if (buildingOptions) {
                buildingOptions.appendChild(buildingsPanel);
            } else {
                buildingTab.appendChild(buildingsPanel);
            }
        } else {
            // 如果找不到building-tab，则附加到body
            document.body.appendChild(buildingsPanel);
        }
    }
    
    buildingsPanel.innerHTML = '';
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '建造建筑';
    buildingsPanel.appendChild(title);
    
    // 添加描述
    const description = document.createElement('p');
    description.textContent = '选择要建造的建筑类型：';
    description.style.marginBottom = '10px';
    buildingsPanel.appendChild(description);
    
    // 添加通用战斗信息
    const combatInfo = document.createElement('p');
    combatInfo.textContent = '⚔️ 所有建筑享有25%的伤害减免';
    combatInfo.style.color = '#e74c3c';
    combatInfo.style.fontSize = '12px';
    combatInfo.style.fontStyle = 'italic';
    combatInfo.style.marginBottom = '15px';
    buildingsPanel.appendChild(combatInfo);
    
    // 遍历建筑类别
    for (const category of BUILDING_CATEGORIES) {
        // 创建类别容器
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'building-category';
        
        // 添加类别标题
        const categoryTitle = document.createElement('h4');
        categoryTitle.textContent = category.name;
        categoryTitle.style.marginBottom = '5px';
        categoryContainer.appendChild(categoryTitle);
        
        // 添加该类别下的建筑
        const buildingsContainer = document.createElement('div');
        buildingsContainer.className = 'buildings-container';
        
        // 筛选该类别的建筑
        const categoryBuildings = Object.entries(BUILDINGS).filter(([_, building]) => building.category === category.id);
        
        for (const [buildingType, building] of categoryBuildings) {
            // 跳过首都，因为不能直接建造
            if (buildingType === 'capital') continue;
            
            // 跳过标记为不能直接建造的建筑
            if (building.cannotBuildDirectly) continue;
            
            // 创建建筑按钮
            const buildingBtn = document.createElement('button');
            buildingBtn.className = 'building-btn';
            buildingBtn.dataset.buildingType = buildingType;
            
            // 计算显示价格（城市动态价格）
            let displayCost = building.cost;
            if (buildingType === 'city') {
                displayCost = getCityCost(currentPlayer);
            }
            
            // 设置按钮内容
            let incomeDisplay;
            if (building.randomIncome) {
                const sign = building.randomIncome.min < 0 ? '' : '+';
                incomeDisplay = `${sign}${building.randomIncome.min}~+${building.randomIncome.max}/回合`;
            } else {
                incomeDisplay = `${building.income >= 0 ? '+' : ''}${building.income}/回合`;
            }
            
            let extraInfo = '';
            if (buildingType === 'city') {
                extraInfo = '<div style="font-size:10px;opacity:0.85;">2x2 | 距首都≥8格</div>';
            } else if (buildingType === 'territoryExpander') {
                extraInfo =
                    '<div style="font-size:10px;opacity:0.85;">无主陆地 | 3×3圈地 | 立即建成</div>';
            }
            
            buildingBtn.innerHTML = `
                <strong>${building.name}</strong>
                <div>¥${displayCost}</div>
                <div>${incomeDisplay}</div>
                ${extraInfo}
            `;
            
            // 添加建筑详情的悬停提示
            const buildTimeLabel =
                building.buildTime === 0 ? '立即建成' : `${building.buildTime}回合`;
            buildingBtn.title = `${building.name}\n${building.desc}\n建造时间：${buildTimeLabel}\n生命值：${building.maxHealth}\n\n战斗属性：所有建筑享有25%的伤害减免${buildingType === 'capital' ? '，但对轰炸机和重型坦克尤其脆弱' : ''}`;
            
            buildingBtn.addEventListener('mouseenter', () => {
                let helpLine = `「${building.name}」${building.desc} — 点击后：在绿色高亮格上选位建造，扣金币并按回合完工。`;
                if (building.neutralOnly) {
                    helpLine = `「${building.name}」${building.desc} — 点击后：地图琥珀色高亮无主陆地空位，点选即建（¥${displayCost}，立即建成）。`;
                } else if (building.waterOnly) {
                    helpLine = `「${building.name}」${building.desc} — 点击后：地图高亮无主水域空位后点选建造。`;
                }
                setGlobalUiHelp(helpLine);
            });
            buildingBtn.addEventListener('mouseleave', () => resetGlobalUiHelp());
            
            // 检查当前玩家是否有足够的金币
            if (currentPlayer.gold < displayCost) {
                buildingBtn.disabled = true;
                buildingBtn.classList.add('disabled');
                buildingBtn.title += '\n\n金币不足！';
            }
            
            // 添加点击事件
            buildingBtn.addEventListener('click', () => {
                gameState.buildMode = true;
                gameState.selectedBuildingType = buildingType;
                updateCursor('build');
                highlightAvailableBuildTiles();
            });
            
            buildingsContainer.appendChild(buildingBtn);
        }
        
        categoryContainer.appendChild(buildingsContainer);
        buildingsPanel.appendChild(categoryContainer);
    }
    
    // 显示面板
    showElement('buildings-panel');
}

// 更新军事单位选项
function updateMilitaryOptions() {
    let militaryPanel = document.getElementById('military-panel');
    
    // 如果元素不存在，则创建它
    if (!militaryPanel) {
        militaryPanel = document.createElement('div');
        militaryPanel.id = 'military-panel';
        
        // 找到一个合适的父元素来附加这个面板
        const militaryTab = document.getElementById('military-tab');
        if (militaryTab) {
            // 检查是否已有military-options元素
            const militaryOptions = document.getElementById('military-options');
            if (militaryOptions) {
                militaryOptions.appendChild(militaryPanel);
            } else {
                militaryTab.appendChild(militaryPanel);
            }
        } else {
            // 如果找不到military-tab，则附加到body
            document.body.appendChild(militaryPanel);
        }
    }
    
    militaryPanel.innerHTML = '';
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '招募军事单位';
    militaryPanel.appendChild(title);
    
    // 添加描述
    const description = document.createElement('p');
    description.textContent = '选择要招募的军事单位：';
    description.style.marginBottom = '10px';
    militaryPanel.appendChild(description);
    
    // 添加通用战斗信息
    const combatInfo = document.createElement('p');
    combatInfo.textContent = '⚔️ 所有单位对建筑造成的伤害有25%减免';
    combatInfo.style.color = '#e74c3c';
    combatInfo.style.fontSize = '12px';
    combatInfo.style.fontStyle = 'italic';
    combatInfo.style.marginBottom = '15px';
    militaryPanel.appendChild(combatInfo);
    
    // 遍历单位类别
    for (const category of UNIT_CATEGORIES) {
        // 创建类别容器
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'unit-category';
        
        // 添加类别标题
        const categoryTitle = document.createElement('h4');
        categoryTitle.textContent = category.name;
        categoryTitle.style.marginBottom = '5px';
        categoryContainer.appendChild(categoryTitle);
        
        // 添加该类别下的单位
        const unitsContainer = document.createElement('div');
        unitsContainer.className = 'units-container';
        
        // 筛选该类别的单位
        const categoryUnits = Object.entries(UNITS).filter(([_, unit]) => unit.type === category.id);
        
        for (const [unitType, unit] of categoryUnits) {
            // 跳过不可招募的单位（如海盗）
            if (unit.cannotRecruit) continue;
            
            // 创建单位按钮
            const unitBtn = document.createElement('button');
            unitBtn.className = 'military-button';
            unitBtn.dataset.unitType = unitType;
            
            // 设置按钮内容
            unitBtn.innerHTML = `
                <strong>${unit.name}</strong>
                <div>¥${unit.cost}</div>
                <div>攻击: ${getUnitAttackStatDisplay(unitType)} | 防御: ${unit.defense}</div>
            `;
            
            // 添加单位详情的悬停提示
            let specialInfo = '';
            if (unit.special) {
                specialInfo = `\n特殊能力：${unit.special.name} - ${unit.special.effect}`;
            }
            
            let combatNote = '';
            if (unitType === 'heavyTank') {
                combatNote = '\n战斗属性：对建筑伤害+50%，但仍受25%的建筑防御减免';
            } else if (unitType === 'bomber') {
                combatNote = '\n战斗属性：对建筑伤害翻倍(×2)，但仍受25%的建筑防御减免';
            } else if (unitType === 'instructor') {
                combatNote = '\n战斗属性：对建筑造成的伤害会减少25%。攻击力取决于周围最多3个单位的一半攻击力总和';
            } else if (unitType === 'archer') {
                combatNote = '\n战斗属性：对单位与建筑均造成目标最大生命35%伤害（单次至少5），不按攻防数值结算；50%概率自伤当前生命50%';
            } else if (unitType === 'bloodBerserker') {
                combatNote = '\n战斗属性：成长仅在该单位亲自攻击并完成击杀/拆建筑时触发，防御塔与导弹不计';
            } else {
                combatNote = '\n战斗属性：对建筑造成的伤害会减少25%';
            }
            
            unitBtn.title = `${unit.name}\n${unit.desc}\n生命值：${unit.health}\n攻击范围：${unit.attackRange} | 移动范围：${unit.moveRange}${specialInfo}${combatNote}`;
            
            unitBtn.addEventListener('mouseenter', () => {
                let line = `「${unit.name}」${unit.desc} — 点击后：在地图高亮格上招募，消耗金币。`;
                if (unit.recruitFromHospital) line += ' 医生仅可在空医院格招募。';
                setGlobalUiHelp(line);
            });
            unitBtn.addEventListener('mouseleave', () => resetGlobalUiHelp());
            
            // 检查当前玩家是否有足够的金币和所需建筑
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            let canRecruit = true;
            let reasonCannotRecruit = '';
            
            // 检查金币
            if (currentPlayer.gold < unit.cost) {
                canRecruit = false;
                reasonCannotRecruit += '金币不足！\n';
            }
            
            // 医生：需有空闲医院格
            if (unit.recruitFromHospital) {
                if (!playerHasDoctorRecruitSlot(currentPlayer)) {
                    canRecruit = false;
                    reasonCannotRecruit += '需要有空闲的医院格（每座医院每回合仅可招募一名医生）。\n';
                }
            } else if (unit.requiredBuildings) {
                // 多建筑要求
                let requiredBuildings = [...unit.requiredBuildings];
                
                // 词条：特殊征召 - 魔法兵无需魔法学院
                if (unitType === 'magicSoldier' && 
                    currentPlayer.enchantments && 
                    currentPlayer.enchantments.includes('specialRecruit')) {
                    requiredBuildings = requiredBuildings.filter(b => b !== 'magicAcademy');
                }
                
                let missingBuildings = [];
                
                for (const buildingType of requiredBuildings) {
                    let hasBuilding = false;
                    for (const playerBuilding of currentPlayer.buildings) {
                        if (playerBuilding.type === buildingType) {
                            hasBuilding = true;
                            break;
                        }
                    }
                    
                    if (!hasBuilding) {
                        missingBuildings.push(BUILDINGS[buildingType].name);
                    }
                }
                
                if (missingBuildings.length > 0) {
                    canRecruit = false;
                    reasonCannotRecruit += `需要建造${missingBuildings.join('和')}！\n`;
                }
            } else if (unit.requiredBuilding) {
                // 单一建筑要求
                let hasRequiredBuilding = false;
                
                for (const playerBuilding of currentPlayer.buildings) {
                    if (playerBuilding.type === unit.requiredBuilding) {
                        hasRequiredBuilding = true;
                        break;
                    }
                }
                
                if (!hasRequiredBuilding) {
                    canRecruit = false;
                    reasonCannotRecruit += `需要建造${BUILDINGS[unit.requiredBuilding].name}！\n`;
                }
            }
            
            // 检查军事限制
            if (!canRecruitMilitaryUnit(unitType)) {
                canRecruit = false;
                reasonCannotRecruit += '本回合已达到招募限制！\n';
            }
            
            // 检查嗜血狂魔解锁条件
            if (unit.unlockCondition) {
                const unlocked = isBloodBerserkerUnlocked(currentPlayer);
                const killCount = (currentPlayer.killHistory || []).length;
                if (!unlocked) {
                    canRecruit = false;
                    reasonCannotRecruit += `未解锁！消灭进度：${killCount}/5（累计，含塔/导弹）\n`;
                }
                // 在按钮上显示解锁进度
                const progressText = unlocked ? '✅ 已解锁' : `🔒 ${killCount}/5消灭`;
                unitBtn.innerHTML = `
                    <strong>${unit.name}</strong> <span style="font-size:11px;color:${unlocked ? '#27ae60' : '#e67e22'}">${progressText}</span>
                    <div>¥${unit.cost}</div>
                    <div>攻击: ${getUnitAttackStatDisplay(unitType)} | 防御: ${unit.defense} | 生命: ${unit.health}</div>
                `;
            }
            
            if (!canRecruit) {
                unitBtn.disabled = true;
                unitBtn.classList.add('disabled');
                unitBtn.title += `\n\n${reasonCannotRecruit}`;
            }
            
            // 添加点击事件
            unitBtn.addEventListener('click', () => {
                gameState.recruitMode = true;
                gameState.selectedUnitType = unitType;
                updateCursor('recruit');
                highlightAvailableRecruitTiles();
            });
            
            unitsContainer.appendChild(unitBtn);
        }
        
        categoryContainer.appendChild(unitsContainer);
        militaryPanel.appendChild(categoryContainer);
    }
    
    // 显示面板
    showElement('military-panel');
}

// 更新词条选项面板
function updateEnchantmentOptions() {
    let enchantmentPanel = document.getElementById('enchantment-options');
    if (!enchantmentPanel) return;
    
    enchantmentPanel.innerHTML = '';
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const totalEnchantments = Object.keys(ENCHANTMENTS).length;
    
    // 已拥有词条标签
    if (currentPlayer.enchantments.length > 0) {
        const ownedTitle = document.createElement('div');
        ownedTitle.className = 'ench-section-title';
        ownedTitle.textContent = `已拥有 (${currentPlayer.enchantments.length}/${totalEnchantments})`;
        enchantmentPanel.appendChild(ownedTitle);
        
        const ownedTags = document.createElement('div');
        ownedTags.className = 'ench-owned-tags';
        
        currentPlayer.enchantments.forEach(enchId => {
            const ench = ENCHANTMENTS[enchId];
            if (ench) {
                const tag = document.createElement('span');
                tag.className = 'ench-tag';
                tag.textContent = `${ench.icon} ${ench.name}`;
                tag.title = ench.desc;
                ownedTags.appendChild(tag);
            }
        });
        
        enchantmentPanel.appendChild(ownedTags);
    }
    
    // 可购买词条
    const availableTitle = document.createElement('div');
    availableTitle.className = 'ench-section-title';
    availableTitle.textContent = '可购买词条';
    enchantmentPanel.appendChild(availableTitle);
    
    const enchList = document.createElement('div');
    enchList.className = 'enchantment-list';
    
    for (const [enchId, ench] of Object.entries(ENCHANTMENTS)) {
        const owned = currentPlayer.enchantments.includes(enchId);
        const canAfford = currentPlayer.gold >= ench.cost;
        
        const card = document.createElement('div');
        card.className = 'enchantment-card';
        if (owned) card.classList.add('ench-owned');
        else if (!canAfford) card.classList.add('ench-disabled');
        
        // 图标
        const icon = document.createElement('div');
        icon.className = 'ench-icon';
        icon.textContent = ench.icon;
        
        // 主体
        const body = document.createElement('div');
        body.className = 'ench-body';
        
        const name = document.createElement('div');
        name.className = 'ench-name';
        name.textContent = ench.name;
        
        const desc = document.createElement('div');
        desc.className = 'ench-desc';
        desc.textContent = ench.desc;
        
        body.appendChild(name);
        body.appendChild(desc);
        
        // 价格
        const price = document.createElement('div');
        price.className = 'ench-price';
        if (owned) {
            price.classList.add('owned-badge');
            price.textContent = '已拥有';
        } else if (canAfford) {
            price.classList.add('affordable');
            price.textContent = `¥${ench.cost}`;
        } else {
            price.classList.add('too-expensive');
            price.textContent = `¥${ench.cost}`;
        }
        
        card.appendChild(icon);
        card.appendChild(body);
        card.appendChild(price);
        
        card.addEventListener('mouseenter', () => {
            if (owned) {
                setGlobalUiHelp(`已拥有「${ench.name}」：${ench.desc}`);
            } else {
                setGlobalUiHelp(`「${ench.name}」¥${ench.cost} — ${ench.desc} ${canAfford ? '点击购买。' : '金币不足。'}`);
            }
        });
        card.addEventListener('mouseleave', () => resetGlobalUiHelp());
        
        if (!owned && canAfford) {
            card.addEventListener('click', () => {
                purchaseEnchantment(enchId);
            });
        }
        
        enchList.appendChild(card);
    }
    
    enchantmentPanel.appendChild(enchList);
}

// 将屏幕事件坐标转换为地图格子坐标（统一计算，点击和悬浮共用）
// 直接用相对位置比例 × 格子数，避免多级浮点运算累积误差
function eventToTileCoords(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;

    return {
        x: Math.min(GRID_WIDTH - 1, Math.max(0, Math.floor(relX * GRID_WIDTH))),
        y: Math.min(GRID_HEIGHT - 1, Math.max(0, Math.floor(relY * GRID_HEIGHT)))
    };
}

// 拖拽检测：记录 mousedown 位置，超过阈值视为拖拽而非点击
let _mouseDownPos = null;
function trackMouseDown(e) {
    _mouseDownPos = { x: e.clientX, y: e.clientY };
}

// 处理画布点击事件
function handleCanvasClick(event) {
    if (gameState.aiExecuting) return;
    
    // 拖拽时不触发点击
    if (_mouseDownPos) {
        const dx = Math.abs(event.clientX - _mouseDownPos.x);
        const dy = Math.abs(event.clientY - _mouseDownPos.y);
        if (dx > 5 || dy > 5) {
            _mouseDownPos = null;
            return;
        }
    }
    _mouseDownPos = null;
    
    const { x, y } = eventToTileCoords(event);
    
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        return;
    }
    
    const tileIndex = y * GRID_WIDTH + x;
    const clickedTile = gameState.map[tileIndex];
    
    // 如果在建造模式
    if (gameState.buildMode) {
        handleBuildModeClick(x, y);
        return;
    }
    
    // 如果在移动模式
    if (gameState.moveMode) {
        handleMoveModeClick(x, y);
        return;
    }
    
    // 如果在攻击模式
    if (gameState.attackMode) {
        handleAttackModeClick(x, y);
        return;
    }
    
    // 如果在修理模式
    if (gameState.repairMode) {
        handleRepairModeClick(x, y);
        return;
    }
    
    // 如果在导弹瞄准模式
    if (gameState.missileMode && gameState.selectedMissileFactory) {
        handleMissileModeClick(x, y);
        return;
    }
    
    // 如果在招募模式
    if (gameState.recruitMode && gameState.selectedUnitType) {
        handleRecruitModeClick(x, y);
        return;
    }
    
    // 选中格子
    gameState.selectedTile = { x, y };
    
    // 更新游戏状态显示
    updateGameStateDisplay();
    
    // 重绘地图
    drawMap();
}

// 处理建造模式点击
function handleBuildModeClick(x, y) {
    const tileIndex = y * GRID_WIDTH + x;
    const clickedTile = gameState.map[tileIndex];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const buildingType = gameState.selectedBuildingType;
    
    // 城市建造使用专用逻辑（城市有特殊放置规则，不做连续建造）
    if (buildingType === 'city') {
        if (startCityBuilding(x, y)) {
            exitBuildMode();
            updateGameStateDisplay();
            drawMap();
        }
        return;
    }
    
    // 海盗船特殊规则：只能放在无主水域上
    const isWaterOnlyBuilding = BUILDINGS[buildingType] && BUILDINGS[buildingType].waterOnly;
    const isNeutralOnlyBuilding = BUILDINGS[buildingType] && BUILDINGS[buildingType].neutralOnly;
    
    if (isWaterOnlyBuilding) {
        if (clickedTile.ownerId !== null) {
            showNotification(`${BUILDINGS[buildingType].name}只能建在无主水域上！`, 'error');
            return;
        }
    } else if (isNeutralOnlyBuilding) {
        if (clickedTile.ownerId !== null) {
            showNotification(`${BUILDINGS[buildingType].name}只能建在无主土地上（不能有领主）！`, 'error');
            return;
        }
    } else {
        if (clickedTile.ownerId !== currentPlayer.id) {
            showNotification('只能在自己的领土上建造建筑！', 'error');
            return;
        }
    }
    
    // 如果点击的格子有建筑或单位，退出建造模式并选中该格子
    if (clickedTile.building || clickedTile.unit) {
        exitBuildMode();
        gameState.selectedTile = { x, y };
        updateGameStateDisplay();
        drawMap();
        return;
    }
    
    // 检查是否已经有建筑进度（包括城市占的2x2区域）
    const existingProgress = gameState.buildingQueue.find(bp => {
        if (bp.x === x && bp.y === y) return true;
        if (bp.isCity && bp.cityTiles) {
            return bp.cityTiles.some(ct => ct.x === x && ct.y === y);
        }
        return false;
    });
    if (existingProgress) {
        showNotification(`该位置已经在建造${BUILDINGS[existingProgress.type].name}！`, 'error');
        return;
    }
    
    // 检查地形约束
    if (isWaterOnlyBuilding) {
        if (clickedTile.terrain !== 'water') {
            showNotification(`${BUILDINGS[buildingType].name}只能建在水域上！`, 'error');
            return;
        }
    } else {
        if (clickedTile.terrain === 'water') {
            showNotification('不能在水域上建造建筑！', 'error');
            return;
        }
    }
    
    if (buildingType === 'mine' && clickedTile.terrain !== 'mountain') {
        showNotification('矿场只能建在山地上！', 'error');
        return;
    }
    
    if (startBuilding(x, y, buildingType)) {
        updateGameStateDisplay();
        drawMap();
        
        const buildingDef = BUILDINGS[buildingType];
        const buildingName = buildingDef.name;
        
        // 唯一建筑建造后退出
        if (buildingDef.isUnique) {
            exitBuildMode();
            showNotification(`开始建造${buildingName}，该建筑为唯一建筑。`, 'success');
            return;
        }
        
        // 检查金币是否还够继续建造
        if (currentPlayer.gold < buildingDef.cost) {
            exitBuildMode();
            showNotification(`${buildingName}已开始建造。金币不足，退出建造模式。`, 'success');
            return;
        }
        
        showNotification(`${buildingName}已开始建造，继续点击可连续放置。`, 'success');
    }
}

// 处理移动模式点击
function handleMoveModeClick(x, y) {
    if (!gameState.selectedUnit) {
        showNotification('没有选中任何单位！', 'error');
        exitMoveMode();
        return;
    }
    
    // 移动单位
    if (moveUnit(gameState.selectedUnit.x, gameState.selectedUnit.y, x, y)) {
        // 移动成功后更新状态
        gameState.selectedTile = { x, y };
        gameState.selectedUnit.x = x;
        gameState.selectedUnit.y = y;
    }
    
    // 退出移动模式
    exitMoveMode();
    
    // 更新游戏状态显示并重绘
    updateGameStateDisplay();
    drawMap();
}

// 处理攻击模式点击
function handleAttackModeClick(x, y) {
    if (!gameState.selectedUnit) {
        showNotification('没有选中任何单位！', 'error');
        exitAttackMode();
        return;
    }
    
    const su = gameState.selectedUnit;
    if (UNITS[su.type] && UNITS[su.type].isHealer) {
        healTarget(su.x, su.y, x, y);
    } else {
        attackTarget(su.x, su.y, x, y);
    }
    
    // 退出攻击模式
    exitAttackMode();
    
    // 更新游戏状态显示并重绘
    updateGameStateDisplay();
    drawMap();
}

// 处理修理模式点击
function handleRepairModeClick(x, y) {
    // 修理建筑
    repairBuilding(x, y);
    
    // 退出修理模式
    exitRepairMode();
    
    // 更新游戏状态显示并重绘
    updateGameStateDisplay();
    drawMap();
}

// 处理招募模式点击
function handleRecruitModeClick(x, y) {
    const tileIndex = y * GRID_WIDTH + x;
    const clickedTile = gameState.map[tileIndex];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 检查是否是当前玩家的领土
    if (clickedTile.ownerId !== currentPlayer.id) {
        showNotification('只能在自己的领土上招募单位！', 'error');
        return;
    }
    
    // 检查是否是水域
    if (clickedTile.terrain === 'water') {
        showNotification('不能在水域上招募单位！', 'error');
        return;
    }
    
    // 检查是否已经有单位
    if (clickedTile.unit) {
        showNotification('该位置已经有单位！', 'error');
        return;
    }
    
    // 招募单位
    const unitType = gameState.selectedUnitType;
    if (recruitUnit(x, y, unitType)) {
        // 退出招募模式
        exitRecruitMode();
        
        // 更新游戏状态显示并重绘
        updateGameStateDisplay();
        drawMap();
        
        // 通知用户单位已招募成功
        const unitName = UNITS[unitType].name;
        showNotification(`成功招募${unitName}！`, 'success');
    }
}

// 处理导弹瞄准模式点击
function handleMissileModeClick(x, y) {
    if (!gameState.selectedMissileFactory) {
        showNotification('未选择导弹工厂！', 'error');
        exitMissileMode();
        return;
    }
    
    launchMissile(gameState.selectedMissileFactory, x, y);
    exitMissileMode();
}

// 退出导弹瞄准模式
function exitMissileMode() {
    gameState.missileMode = false;
    gameState.selectedMissileFactory = null;
    hideElement('cancel-action-btn');
    updateCursor('default');
    clearTileHighlights();
    drawMap();
}

// 高亮导弹AoE范围预览（整个地图都是合法目标，但显示当前鼠标位置的爆炸范围）
function highlightMissileRange() {
    clearTileHighlights();
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const idx = y * GRID_WIDTH + x;
            gameState.map[idx].highlight = {
                color: 'rgba(231, 76, 60, 0.15)',
                border: '1px solid rgba(231, 76, 60, 0.3)'
            };
        }
    }
    
    drawMap();
}

// 开始建造模式
function startBuildMode(buildingType) {
    gameState.buildMode = true;
    gameState.selectedBuildingType = buildingType;
    
    // 显示取消按钮
    showElement('cancel-action-btn');
    
    // 显示通知
    showNotification(`选择一个位置来建造${BUILDINGS[buildingType].name}。`, 'info');
}

// 退出建造模式
function exitBuildMode() {
    gameState.buildMode = false;
    gameState.selectedBuildingType = null;
    
    hideElement('cancel-action-btn');
    updateCursor('default');
    clearTileHighlights();
}

// 开始移动模式
function startMoveMode() {
    if (!gameState.selectedUnit) {
        showNotification('没有选中任何单位！', 'error');
        return;
    }
    
    // 有城市时检查是否已移动
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (playerHasCity(currentPlayer) && gameState.selectedUnit.hasMoved) {
        showNotification('该单位本回合已移动！', 'error');
        return;
    }
    
    gameState.moveMode = true;
    
    // 显示取消按钮
    showElement('cancel-action-btn');
    
    // 显示通知
    showNotification('选择一个位置来移动单位。', 'info');
    
    // 重绘以显示移动范围
    drawMap();
}

// 退出移动模式
function exitMoveMode() {
    gameState.moveMode = false;
    
    hideElement('cancel-action-btn');
    updateCursor('default');
    drawMap();
}

// 开始攻击模式
function startAttackMode() {
    if (!gameState.selectedUnit) {
        showNotification('没有选中任何单位！', 'error');
        return;
    }
    
    const su = gameState.selectedUnit;
    const def = UNITS[su.type];
    const isHealer = def && def.isHealer;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (playerHasCity(currentPlayer) && su.hasAttacked) {
        showNotification(isHealer ? '该单位本回合已治疗过！' : '该单位本回合已攻击！', 'error');
        return;
    }
    
    if (!playerHasCity(currentPlayer) && su.hasActed) {
        showNotification('该单位本回合已行动！', 'error');
        return;
    }
    
    gameState.attackMode = true;
    
    showElement('cancel-action-btn');
    
    showNotification(
        isHealer ? '选择范围内受伤的友方军事单位进行治疗。' : '选择一个目标来攻击。',
        'info'
    );
    
    updateCursor(isHealer ? 'heal' : 'attack');
    
    drawMap();
}

// 退出攻击模式
function exitAttackMode() {
    gameState.attackMode = false;
    
    hideElement('cancel-action-btn');
    updateCursor('default');
    drawMap();
    syncMilitaryActionButtons();
}

// 开始修理模式
function startRepairMode() {
    gameState.repairMode = true;
    
    // 显示取消按钮
    showElement('cancel-action-btn');
    
    // 显示通知
    showNotification('选择一个需要修理的建筑。', 'info');
}

// 退出修理模式
function exitRepairMode() {
    gameState.repairMode = false;
    gameState.selectedBuilding = null;
    hideElement('cancel-action-btn');
    updateCursor('default');
    clearTileHighlights();
}

// 退出招募模式
function exitRecruitMode() {
    gameState.recruitMode = false;
    gameState.selectedUnitType = null;
    hideElement('cancel-action-btn');
    hideElement('unit-preview');
    updateCursor('default');
    clearTileHighlights();
}

// 更新鼠标光标样式
function updateCursor(mode) {
    // 所有自定义光标均使用 16 16 热点（图标中心），确保点击位置精准匹配视觉中心
    if (mode === 'build') {
        canvas.style.cursor = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="10" height="10" rx="2" ry="2"/><path d="M12 3v18"/><path d="M3 12h18"/></svg>\') 16 16, auto';
    } else if (mode === 'recruit') {
        canvas.style.cursor = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M12 11v8"/><path d="M8 15h8"/></svg>\') 16 16, auto';
    } else if (mode === 'heal') {
        canvas.style.cursor = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%2327ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>\') 16 16, auto';
    } else if (mode === 'attack') {
        canvas.style.cursor = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>\') 16 16, auto';
    } else if (mode === 'move') {
        canvas.style.cursor = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%233498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7-7 7 7"/><path d="M12 2v20"/></svg>\') 16 16, auto';
    } else if (mode === 'repair') {
        canvas.style.cursor = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%232ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>\') 16 16, auto';
    } else if (mode === 'default') {
        canvas.style.cursor = 'default';
    }
}

// 检查是否可以招募指定类型的军事单位
function canRecruitMilitaryUnit(unitType) {
    const unitInfo = UNITS[unitType];
    if (!unitInfo) return true;
    
    if (unitInfo.recruitFromHospital) {
        return playerHasDoctorRecruitSlot(gameState.players[gameState.currentPlayerIndex]);
    }
    
    const requiredBuilding = unitInfo.requiredBuilding;
    if (!requiredBuilding) return true;
    
    if (requiredBuilding === 'barracks') {
        return gameState.factoryProduction.barracksBuiltThisRound < 1;
    } else if (requiredBuilding === 'armoryFactory') {
        return gameState.factoryProduction.armoryFactoryBuiltThisRound < 1;
    } else if (requiredBuilding === 'bigArmoryFactory') {
        return gameState.factoryProduction.bigArmoryFactoryBuiltThisRound < 2;
    }
    
    return true;
}

// 重置所有游戏模式
function resetGameModes() {
    gameState.buildMode = false;
    gameState.selectedBuildingType = null;
    gameState.moveMode = false;
    gameState.attackMode = false;
    gameState.repairMode = false;
    gameState.recruitMode = false;
    gameState.missileMode = false;
    gameState.selectedMissileFactory = null;
    gameState.selectedUnitType = null;
    
    hideElement('cancel-action-btn');
    hideElement('building-preview');
    hideElement('unit-preview');
    updateCursor('default');
    clearTileHighlights();
    drawMap();
}

// 取消当前操作
function cancelCurrentAction() {
    resetGameModes();
    
    // 更新游戏状态显示
    updateGameStateDisplay();
}

// 结束当前回合
function endTurn() {
    // 防止AI回合时人类手动结束回合
    const curPlayer = gameState.players[gameState.currentPlayerIndex];
    if (curPlayer && curPlayer.isAI && gameState.aiExecuting) return;
    
    resetGameModes();
    processEndOfTurn();
    updateGameStateDisplay();
    drawMap();
    
    // 如果下一个玩家是AI，自动执行AI回合
    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    if (nextPlayer && nextPlayer.isAI && !nextPlayer.isDefeated && !gameState.isGameOver) {
        setTimeout(() => executeAITurn(), 600);
    }
}

// 获取地形名称
function getTerrainName(terrain) {
    const terrainNames = {
        'plain': '平原',
        'forest': '森林',
        'mountain': '山脉',
        'water': '水域'
    };
    
    return terrainNames[terrain] || terrain;
}

// 显示玩家数量选择对话框（支持AI玩家和地图尺寸设置）
function showPlayerCountDialog() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;';
    
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:#fff;padding:24px 28px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);width:400px;text-align:center;max-height:90vh;overflow-y:auto;';
    
    let selectedCount = 2;
    let aiPlayerIndices = new Set();
    let selectedMapSize = getRecommendedMapSize(selectedCount);
    
    function render() {
        dialog.innerHTML = '';
        
        const title = document.createElement('h3');
        title.textContent = '新游戏设置';
        title.style.cssText = 'margin:0 0 18px 0;font-size:18px;color:#2c3e50;';
        dialog.appendChild(title);
        
        // ====== 参战人数 ======
        const countLabel = document.createElement('div');
        countLabel.textContent = '参战人数';
        countLabel.style.cssText = 'font-size:13px;color:#777;margin-bottom:8px;font-weight:600;';
        dialog.appendChild(countLabel);
        
        const countRow = document.createElement('div');
        countRow.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-bottom:16px;';
        
        for (let i = 2; i <= 5; i++) {
            const btn = document.createElement('button');
            btn.textContent = `${i}人`;
            const isSelected = i === selectedCount;
            btn.style.cssText = `width:56px;height:40px;border-radius:6px;font-size:15px;font-weight:700;border:2px solid ${isSelected ? '#3498db' : '#ddd'};background:${isSelected ? '#3498db' : '#fff'};color:${isSelected ? '#fff' : '#555'};cursor:pointer;transition:all 0.15s;`;
            btn.addEventListener('click', () => {
                selectedCount = i;
                for (const idx of [...aiPlayerIndices]) {
                    if (idx >= i) aiPlayerIndices.delete(idx);
                }
                selectedMapSize = getRecommendedMapSize(i);
                render();
            });
            countRow.appendChild(btn);
        }
        dialog.appendChild(countRow);
        
        // ====== 地图尺寸 ======
        const mapLabel = document.createElement('div');
        mapLabel.textContent = '地图尺寸';
        mapLabel.style.cssText = 'font-size:13px;color:#777;margin-bottom:8px;font-weight:600;';
        dialog.appendChild(mapLabel);
        
        const mapRow = document.createElement('div');
        mapRow.style.cssText = 'display:flex;flex-direction:column;gap:5px;margin-bottom:16px;';
        
        for (const [key, size] of Object.entries(MAP_SIZES)) {
            const isSelected = key === selectedMapSize;
            const isRecommended = key === getRecommendedMapSize(selectedCount);
            
            const sizeBtn = document.createElement('div');
            sizeBtn.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-radius:6px;border:2px solid ${isSelected ? '#3498db' : '#e8e8e8'};background:${isSelected ? '#eef4ff' : '#fafafa'};cursor:pointer;transition:all 0.15s;`;
            
            const leftPart = document.createElement('div');
            leftPart.style.cssText = 'display:flex;align-items:center;gap:8px;';
            
            const radio = document.createElement('div');
            radio.style.cssText = `width:16px;height:16px;border-radius:50%;border:2px solid ${isSelected ? '#3498db' : '#bbb'};background:${isSelected ? '#3498db' : '#fff'};flex-shrink:0;position:relative;`;
            if (isSelected) {
                const dot = document.createElement('div');
                dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#fff;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
                radio.appendChild(dot);
            }
            
            const nameLabel = document.createElement('span');
            nameLabel.style.cssText = `font-weight:700;font-size:14px;color:${isSelected ? '#2c3e50' : '#555'};`;
            nameLabel.textContent = size.name;
            
            leftPart.appendChild(radio);
            leftPart.appendChild(nameLabel);
            
            const rightPart = document.createElement('div');
            rightPart.style.cssText = 'display:flex;align-items:center;gap:6px;';
            
            const descSpan = document.createElement('span');
            descSpan.style.cssText = 'font-size:12px;color:#999;';
            descSpan.textContent = size.desc;
            rightPart.appendChild(descSpan);
            
            if (isRecommended) {
                const badge = document.createElement('span');
                badge.style.cssText = 'font-size:10px;padding:1px 6px;border-radius:8px;background:#27ae60;color:#fff;font-weight:600;white-space:nowrap;';
                badge.textContent = `${size.recommend}推荐`;
                rightPart.appendChild(badge);
            }
            
            sizeBtn.appendChild(leftPart);
            sizeBtn.appendChild(rightPart);
            
            sizeBtn.addEventListener('click', () => {
                selectedMapSize = key;
                render();
            });
            
            mapRow.appendChild(sizeBtn);
        }
        dialog.appendChild(mapRow);
        
        // ====== 玩家列表 ======
        const listLabel = document.createElement('div');
        listLabel.textContent = '玩家设置（点击切换 人类/电脑）';
        listLabel.style.cssText = 'font-size:13px;color:#777;margin-bottom:8px;font-weight:600;';
        dialog.appendChild(listLabel);
        
        const playerList = document.createElement('div');
        playerList.style.cssText = 'display:flex;flex-direction:column;gap:5px;margin-bottom:18px;';
        
        const playerColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        for (let i = 0; i < selectedCount; i++) {
            const isAI = aiPlayerIndices.has(i);
            const row = document.createElement('div');
            row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;border:1.5px solid ${isAI ? '#e67e22' : '#27ae60'};background:${isAI ? '#fef5e7' : '#f0faf4'};cursor:pointer;transition:all 0.15s;`;
            
            const colorDot = document.createElement('span');
            colorDot.style.cssText = `width:12px;height:12px;border-radius:50%;background:${playerColors[i]};flex-shrink:0;`;
            
            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'font-weight:600;font-size:14px;flex:1;text-align:left;margin-left:10px;';
            nameSpan.textContent = `玩家${i + 1}`;
            
            const typeTag = document.createElement('span');
            typeTag.style.cssText = `font-size:12px;padding:2px 10px;border-radius:10px;font-weight:700;background:${isAI ? '#e67e22' : '#27ae60'};color:#fff;`;
            typeTag.textContent = isAI ? '🤖 电脑' : '👤 人类';
            
            row.appendChild(colorDot);
            row.appendChild(nameSpan);
            row.appendChild(typeTag);
            
            row.addEventListener('click', () => {
                if (isAI) {
                    aiPlayerIndices.delete(i);
                } else {
                    const humanCount = selectedCount - aiPlayerIndices.size;
                    if (humanCount <= 1) {
                        showNotification('至少需要1个人类玩家！', 'error');
                        return;
                    }
                    aiPlayerIndices.add(i);
                }
                render();
            });
            
            playerList.appendChild(row);
        }
        dialog.appendChild(playerList);
        
        // ====== 按钮行 ======
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;';
        
        const startBtn = document.createElement('button');
        const aiCount = aiPlayerIndices.size;
        const humanCount = selectedCount - aiCount;
        const mapInfo = MAP_SIZES[selectedMapSize];
        const label = aiCount > 0 
            ? `开始 (${humanCount}人+${aiCount}电脑 · ${mapInfo.name}地图)` 
            : `开始 ${selectedCount}人 · ${mapInfo.name}地图`;
        startBtn.textContent = label;
        startBtn.style.cssText = 'flex:1;padding:10px;font-size:14px;font-weight:700;background:#3498db;color:#fff;border:none;border-radius:6px;cursor:pointer;';
        startBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            startNewGame(selectedCount, [...aiPlayerIndices], selectedMapSize);
        });
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'width:70px;padding:10px;font-size:14px;background:#e74c3c;color:#fff;border:none;border-radius:6px;cursor:pointer;';
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        btnRow.appendChild(startBtn);
        btnRow.appendChild(cancelBtn);
        dialog.appendChild(btnRow);
    }
    
    render();
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

// 高亮可建造的格子
function highlightAvailableBuildTiles() {
    clearTileHighlights();
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const buildingType = gameState.selectedBuildingType;
    
    // 城市：高亮所有有效的2x2起始点
    if (buildingType === 'city') {
        for (let y = 0; y < GRID_HEIGHT - 1; y++) {
            for (let x = 0; x < GRID_WIDTH - 1; x++) {
                const validation = validateCityPlacement(x, y, currentPlayer);
                if (validation.valid) {
                    // 高亮2x2区域
                    const tiles = [
                        { tx: x, ty: y }, { tx: x + 1, ty: y },
                        { tx: x, ty: y + 1 }, { tx: x + 1, ty: y + 1 }
                    ];
                    for (const { tx, ty } of tiles) {
                        const idx = ty * GRID_WIDTH + tx;
                        gameState.map[idx].highlight = {
                            color: 'rgba(155, 89, 182, 0.4)',
                            border: '2px solid #8e44ad'
                        };
                    }
                }
            }
        }
        drawMap();
        return;
    }
    
    // 判断是否为水域专属建筑 / 无主陆地专属建筑
    const isWaterOnly = BUILDINGS[buildingType] && BUILDINGS[buildingType].waterOnly;
    const isNeutralOnly = BUILDINGS[buildingType] && BUILDINGS[buildingType].neutralOnly;
    
    // 普通建筑高亮
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const tileIndex = y * GRID_WIDTH + x;
            const tile = gameState.map[tileIndex];
            
            if (isWaterOnly) {
                // 水域专属建筑（海盗船）：只高亮无主水域
                if (tile.ownerId !== null || tile.terrain !== 'water' || tile.building || tile.unit) continue;
            } else if (isNeutralOnly) {
                // 领地扩张器：无主陆地、空格子
                if (tile.ownerId !== null || tile.terrain === 'water' || tile.building || tile.unit) continue;
            } else {
                // 普通建筑：必须在自己领地上
                if (tile.ownerId !== currentPlayer.id || tile.building || tile.unit) continue;
                if (tile.terrain === 'water') continue;
                if (buildingType === 'mine' && tile.terrain !== 'mountain') continue;
            }
            
            let hlColor;
            let hlBorder;
            if (isWaterOnly) {
                hlColor = 'rgba(52, 152, 219, 0.4)';
                hlBorder = '2px solid #2980b9';
            } else if (isNeutralOnly) {
                hlColor = 'rgba(241, 196, 15, 0.38)';
                hlBorder = '2px solid #ca8f04';
            } else {
                hlColor = 'rgba(46, 204, 113, 0.4)';
                hlBorder = '2px solid #27ae60';
            }
            tile.highlight = { color: hlColor, border: hlBorder };
        }
    }
    
    drawMap();
}

// 高亮可招募单位的格子
function highlightAvailableRecruitTiles() {
    clearTileHighlights();
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const selType = gameState.selectedUnitType;
    const forDoctor = selType && UNITS[selType] && UNITS[selType].recruitFromHospital;
    const usedKeys = gameState.factoryProduction.hospitalDoctorRecruitKeys || [];
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const tileIndex = y * GRID_WIDTH + x;
            const tile = gameState.map[tileIndex];
            
            if (forDoctor) {
                if (tile.ownerId !== currentPlayer.id || !tile.building || tile.unit) continue;
                if (tile.building.type !== 'hospital' && tile.building.type !== 'bigHospital') continue;
                if (usedKeys.includes(`${x},${y}`)) continue;
                tile.highlight = {
                    color: 'rgba(46, 204, 113, 0.35)',
                    border: '2px solid #27ae60'
                };
            } else {
                if (tile.ownerId === currentPlayer.id && !tile.unit) {
                    if (tile.terrain === 'water') continue;
                    tile.highlight = {
                        color: 'rgba(52, 152, 219, 0.4)',
                        border: '2px solid #2980b9'
                    };
                }
            }
        }
    }
    
    drawMap();
}

// 清除所有格子的高亮效果
function clearTileHighlights() {
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        tile.highlight = null;
    }
}

// 显示反馈二维码弹窗
function showFeedbackForm() {
    // 如果弹窗已经显示，则关闭它
    if (feedbackContainerVisible && feedbackContainer) {
        closeFeedbackForm();
        return;
    }
    
    // 检测系统语言
    const userLanguage = navigator.language || navigator.userLanguage || '';
    const isChineseUser = userLanguage.toLowerCase().startsWith('zh');
    
    // 创建反馈弹窗容器
    feedbackContainer = document.createElement('div');
    feedbackContainer.id = 'feedback-container';
    feedbackContainer.className = 'feedback-container';
    feedbackContainer.style.position = 'fixed';
    feedbackContainer.style.top = '50%';
    feedbackContainer.style.left = '50%';
    feedbackContainer.style.transform = 'translate(-50%, -50%)';
    feedbackContainer.style.backgroundColor = '#fff';
    feedbackContainer.style.padding = '20px';
    feedbackContainer.style.borderRadius = '16px';
    feedbackContainer.style.boxShadow = '0 5px 25px rgba(0, 0, 0, 0.25)';
    feedbackContainer.style.zIndex = '1000';
    feedbackContainer.style.maxWidth = '300px';
    feedbackContainer.style.width = '90%';
    feedbackContainer.style.textAlign = 'center';

    // 添加内容
    feedbackContainer.innerHTML = `
        <h3 style="margin-top: 0; color: #3498db; font-size: 18px;">${isChineseUser ? '支持开发者' : 'Support Developer'}</h3>
        
        <!-- 选项卡 -->
        <div style="display: flex; justify-content: center; margin-bottom: 15px; border-bottom: 1px solid #eee;">
            <div id="wechat-tab" class="feedback-tab" style="padding: 8px 15px; cursor: pointer; ${isChineseUser ? 'border-bottom: 2px solid #3498db; color: #3498db; font-weight: bold;' : 'color: #777;'}">微信</div>
            <div id="twitter-tab" class="feedback-tab" style="padding: 8px 15px; cursor: pointer; ${isChineseUser ? 'color: #777;' : 'border-bottom: 2px solid #1DA1F2; color: #1DA1F2; font-weight: bold;'}">Twitter</div>
            <div id="coffee-tab" class="feedback-tab" style="padding: 8px 15px; cursor: pointer; color: #777;">Coffee</div>
        </div>
        
        <!-- 微信内容 -->
        <div id="wechat-content" style="${isChineseUser ? 'display: block;' : 'display: none;'}">
            <p style="font-size: 13px; margin-bottom: 12px; color: #555;">
                扫码添加开发者微信，直接交流您的游戏体验和建议
            </p>
            <div style="margin: 10px 0; padding: 10px; border: 1px dashed #ddd; display: inline-block; border-radius: 8px;">
                <!-- 微信二维码 -->
                <img src="./assets/author-wechat-qrcode.png" width="140" height="140" alt="开发者微信二维码">
            </div>
            <p style="font-size: 12px; color: #27ae60; margin: 10px 0;">
                <strong>添加微信，获得更多特权：</strong><br>
                • 获取最新游戏更新资讯<br>
                • 参与游戏设计与开发讨论<br>
                • 提前体验新功能特性
            </p>
        </div>
        
        <!-- Twitter内容 -->
        <div id="twitter-content" style="${isChineseUser ? 'display: none;' : 'display: block;'}">
            <p style="font-size: 13px; margin-bottom: 12px; color: #555;">
                Follow the developer on Twitter for updates and discussions:
            </p>
            <div style="margin: 15px 0; padding: 15px; border: 1px dashed #1DA1F2; background-color: #F5F8FA; display: inline-block; border-radius: 8px;">
                <a href="https://x.com/talkgo_night" target="_blank" style="text-decoration: none; color: #1DA1F2; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#1DA1F2" d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
                    @talkgo_night
                </a>
            </div>
            <p style="font-size: 12px; color: #1DA1F2; margin: 10px 0;">
                <strong>Benefits of following:</strong><br>
                • Get the latest game updates<br>
                • Join development discussions<br>
                • Early access to new features
            </p>
            <a href="https://x.com/talkgo_night" target="_blank" style="display: inline-block; background-color: #1DA1F2; color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; font-weight: bold; margin-top: 10px;">
                Follow on Twitter
            </a>
        </div>
        
        <!-- Buy Me a Coffee内容 -->
        <div id="coffee-content" style="display: none;">
            <p style="font-size: 13px; margin-bottom: 12px; color: #555;">
                ${isChineseUser ? '如果您喜欢这个游戏，可以请开发者喝杯咖啡支持一下！' : 'If you enjoy this game, consider buying the developer a coffee!'}
            </p>
            <div style="margin: 10px 0; padding: 10px; border: 1px dashed #FFDD00; background-color: #FFFEF4; display: inline-block; border-radius: 8px;">
                <!-- Buy Me a Coffee二维码 -->
                <img src="./assets/bmc_qr_maiyang.png" width="140" height="140" alt="Buy Me a Coffee二维码">
            </div>
            <p style="font-size: 12px; color: #FF813F; margin: 10px 0;">
                <strong>${isChineseUser ? '您的支持将用于：' : 'Your support will help with:'}</strong><br>
                ${isChineseUser ? '• 开发更多游戏功能' : '• Developing more game features'}<br>
                ${isChineseUser ? '• 维护服务器和域名' : '• Maintaining servers and domains'}<br>
                ${isChineseUser ? '• 鼓励开发者继续创作' : '• Encouraging continued development'}
            </p>
        </div>
        
        <button id="cancel-feedback" style="padding: 6px 16px; border: none; background-color: #f0f0f0; border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.2s; margin-top: 8px;">${isChineseUser ? '关闭' : 'Close'}</button>
    `;

    // 添加到文档
    document.body.appendChild(feedbackContainer);
    feedbackContainerVisible = true;
    
    // 添加选项卡切换事件
    document.getElementById('wechat-tab').addEventListener('click', () => {
        document.getElementById('wechat-tab').style.borderBottom = '2px solid #3498db';
        document.getElementById('wechat-tab').style.color = '#3498db';
        document.getElementById('wechat-tab').style.fontWeight = 'bold';
        document.getElementById('twitter-tab').style.borderBottom = 'none';
        document.getElementById('twitter-tab').style.color = '#777';
        document.getElementById('twitter-tab').style.fontWeight = 'normal';
        document.getElementById('coffee-tab').style.borderBottom = 'none';
        document.getElementById('coffee-tab').style.color = '#777';
        document.getElementById('coffee-tab').style.fontWeight = 'normal';
        
        document.getElementById('wechat-content').style.display = 'block';
        document.getElementById('twitter-content').style.display = 'none';
        document.getElementById('coffee-content').style.display = 'none';
    });
    
    document.getElementById('twitter-tab').addEventListener('click', () => {
        document.getElementById('twitter-tab').style.borderBottom = '2px solid #1DA1F2';
        document.getElementById('twitter-tab').style.color = '#1DA1F2';
        document.getElementById('twitter-tab').style.fontWeight = 'bold';
        document.getElementById('wechat-tab').style.borderBottom = 'none';
        document.getElementById('wechat-tab').style.color = '#777';
        document.getElementById('wechat-tab').style.fontWeight = 'normal';
        document.getElementById('coffee-tab').style.borderBottom = 'none';
        document.getElementById('coffee-tab').style.color = '#777';
        document.getElementById('coffee-tab').style.fontWeight = 'normal';
        
        document.getElementById('wechat-content').style.display = 'none';
        document.getElementById('twitter-content').style.display = 'block';
        document.getElementById('coffee-content').style.display = 'none';
    });
    
    document.getElementById('coffee-tab').addEventListener('click', () => {
        document.getElementById('coffee-tab').style.borderBottom = '2px solid #FFDD00';
        document.getElementById('coffee-tab').style.color = '#FF813F';
        document.getElementById('coffee-tab').style.fontWeight = 'bold';
        document.getElementById('wechat-tab').style.borderBottom = 'none';
        document.getElementById('wechat-tab').style.color = '#777';
        document.getElementById('wechat-tab').style.fontWeight = 'normal';
        document.getElementById('twitter-tab').style.borderBottom = 'none';
        document.getElementById('twitter-tab').style.color = '#777';
        document.getElementById('twitter-tab').style.fontWeight = 'normal';
        
        document.getElementById('wechat-content').style.display = 'none';
        document.getElementById('twitter-content').style.display = 'none';
        document.getElementById('coffee-content').style.display = 'block';
    });

    // 添加事件监听器 - 使用函数而不是内联匿名函数
    document.getElementById('cancel-feedback').addEventListener('click', closeFeedbackForm);
    
    // 添加点击外部关闭功能
    document.addEventListener('click', handleOutsideClick);
}

// 关闭反馈弹窗的函数
function closeFeedbackForm() {
    if (feedbackContainer && document.body.contains(feedbackContainer)) {
        document.body.removeChild(feedbackContainer);
        feedbackContainerVisible = false;
        feedbackContainer = null;
        
        // 移除外部点击事件监听器
        document.removeEventListener('click', handleOutsideClick);
    }
}

// 处理点击弹窗外部的事件
function handleOutsideClick(event) {
    // 如果点击的不是弹窗内部的元素且不是反馈按钮，则关闭弹窗
    if (feedbackContainer && !feedbackContainer.contains(event.target) && 
        event.target.id !== 'float-feedback-btn') {
        closeFeedbackForm();
    }
}

// ========== 地图悬浮提示框 ==========

let _lastHoverTileX = -1;
let _lastHoverTileY = -1;

function handleCanvasHover(event) {
    if (!gameState || !gameState.map || gameState.map.length === 0) return;

    const tooltip = document.getElementById('map-tooltip');
    if (!tooltip) return;

    const { x: tileX, y: tileY } = eventToTileCoords(event);

    if (tileX < 0 || tileX >= GRID_WIDTH || tileY < 0 || tileY >= GRID_HEIGHT) {
        hideMapTooltip();
        return;
    }

    // 仅在切换到新格子时更新内容
    if (tileX !== _lastHoverTileX || tileY !== _lastHoverTileY) {
        _lastHoverTileX = tileX;
        _lastHoverTileY = tileY;

        const tileIndex = tileY * GRID_WIDTH + tileX;
        const tile = gameState.map[tileIndex];
        const html = buildTooltipHTML(tile, tileX, tileY);

        if (!html) {
            hideMapTooltip();
            return;
        }

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');
    }

    // 更新位置（每次鼠标移动都更新）
    const offsetX = 14;
    const offsetY = 14;
    let left = event.clientX + offsetX;
    let top = event.clientY + offsetY;

    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (left + tw > window.innerWidth - 8) left = event.clientX - tw - offsetX;
    if (top + th > window.innerHeight - 8) top = event.clientY - th - offsetY;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

function hideMapTooltip() {
    _lastHoverTileX = -1;
    _lastHoverTileY = -1;
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
}

function buildTooltipHTML(tile, x, y) {
    const lines = [];

    // 地形
    const terrainName = getTerrainName(tile.terrain);

    // 所有者
    let ownerStr = '';
    if (tile.ownerId !== null) {
        const owner = gameState.players[tile.ownerId];
        ownerStr = `<span style="color:${owner.color.main}">${owner.name}</span>`;
    }

    // 建筑信息
    const building = tile.building;
    const unit = tile.unit;

    // 如果既无建筑也无单位，只显示简洁的地形+坐标
    if (!building && !unit) {
        lines.push(`<div class="tooltip-title">${terrainName} (${x},${y})</div>`);
        if (ownerStr) lines.push(`<div class="tooltip-row"><span class="tooltip-label">领地</span>${ownerStr}</div>`);

        // 检查是否有建造中的建筑
        const inProgress = gameState.buildingQueue ? gameState.buildingQueue.find(bp => {
            if (bp.x === x && bp.y === y) return true;
            if (bp.isCity && bp.cityTiles) return bp.cityTiles.some(ct => ct.x === x && ct.y === y);
            return false;
        }) : null;

        if (inProgress) {
            const bName = BUILDINGS[inProgress.type] ? BUILDINGS[inProgress.type].name : inProgress.type;
            lines.push(`<div class="tooltip-sep"></div>`);
            lines.push(`<div class="tooltip-title">建造中: ${bName}</div>`);
            lines.push(`<div class="tooltip-row"><span class="tooltip-label">进度</span><span class="tooltip-value">${inProgress.progress}%</span></div>`);
        }

        return lines.join('');
    }

    // 有建筑
    if (building) {
        const bDef = BUILDINGS[building.type];
        const bName = building.name || (bDef ? bDef.name : '未知建筑');
        lines.push(`<div class="tooltip-title">${bName}</div>`);
        lines.push(`<div class="tooltip-row"><span class="tooltip-label">坐标</span><span>(${x},${y}) ${terrainName}</span></div>`);
        if (building.type === 'pirateShip') {
            lines.push(`<div class="tooltip-row"><span class="tooltip-label">领地</span><span class="tooltip-value">无主（不占领水域）</span></div>`);
            if (building.placedByPlayerId != null) {
                const b = gameState.players[building.placedByPlayerId];
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">建造者</span><span style="color:${b.color.main}">${b.name}</span></div>`);
            }
        } else if (ownerStr) {
            lines.push(`<div class="tooltip-row"><span class="tooltip-label">所有者</span>${ownerStr}</div>`);
        }

        if (bDef) {
            const maxHP = bDef.maxHealth;
            const curHP = Math.max(0, building.health || 0);
            const pct = Math.round((curHP / maxHP) * 100);
            const hpClass = pct > 70 ? 'tooltip-hp-good' : pct > 30 ? 'tooltip-hp-warn' : 'tooltip-hp-crit';
            lines.push(`<div class="tooltip-row"><span class="tooltip-label">生命</span><span class="${hpClass} tooltip-value">${curHP}/${maxHP}</span></div>`);

            if (bDef.randomIncome) {
                const last = building.lastRandomIncome !== undefined ? building.lastRandomIncome : '?';
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">收入</span><span class="tooltip-value">${bDef.randomIncome.min}~${bDef.randomIncome.max} (上回合:${last})</span></div>`);
            } else if (bDef.income !== 0) {
                const sign = bDef.income > 0 ? '+' : '';
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">收入</span><span class="tooltip-value">${sign}${bDef.income}/回合</span></div>`);
            }

            if (building.isCityPart) {
                lines.push(`<div style="font-size:11px;opacity:0.7;margin-top:2px;">城市副格(锚点:${building.anchorX},${building.anchorY})</div>`);
            }
            
            if (building.type === 'missileFactory') {
                const stored = building.storedMissiles || 0;
                const maxM = BUILDINGS.missileFactory.maxMissiles;
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">导弹</span><span class="tooltip-value">${stored}/${maxM}</span></div>`);
                if (building.missileBuilding) {
                    lines.push(`<div style="color:#f39c12;font-size:11px;">建造中(${building.missileBuildTurns}回合)</div>`);
                }
            }
        }
    }

    // 有单位
    if (unit) {
        if (building) lines.push(`<div class="tooltip-sep"></div>`);
        const uDef = UNITS[unit.type];
        const uName = uDef ? uDef.name : '未知单位';
        lines.push(`<div class="tooltip-title">${uName}</div>`);
        if (!building) {
            lines.push(`<div class="tooltip-row"><span class="tooltip-label">坐标</span><span>(${x},${y}) ${terrainName}</span></div>`);
            if (ownerStr) lines.push(`<div class="tooltip-row"><span class="tooltip-label">所有者</span>${ownerStr}</div>`);
        }

        if (uDef) {
            const maxHP = uDef.health;
            const curHP = Math.max(0, isNaN(unit.health) ? 0 : unit.health);
            const pct = Math.round((curHP / maxHP) * 100);
            const hpClass = pct > 70 ? 'tooltip-hp-good' : pct > 30 ? 'tooltip-hp-warn' : 'tooltip-hp-crit';
            lines.push(`<div class="tooltip-row"><span class="tooltip-label">生命</span><span class="${hpClass} tooltip-value">${curHP}/${maxHP}</span></div>`);

            let atkDisplay = getUnitAttackStatDisplay(unit.type);
            if (unit.type === 'instructor') {
                const calcFn = window.calculateInstructorAttack || calculateInstructorAttackLocal;
                atkDisplay = calcFn(unit);
            }
            if (uDef.isHealer) {
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">攻/防</span><span class="tooltip-value">— / ${uDef.defense}</span></div>`);
                const hR = uDef.healRange != null ? uDef.healRange : uDef.attackRange;
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">移动/治疗</span><span class="tooltip-value">${uDef.moveRange} / ${hR}</span></div>`);
            } else {
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">攻/防</span><span class="tooltip-value">${atkDisplay} / ${uDef.defense}</span></div>`);
                lines.push(`<div class="tooltip-row"><span class="tooltip-label">移动/攻击</span><span class="tooltip-value">${uDef.moveRange} / ${uDef.attackRange}</span></div>`);
            }

            if (unit.hasActed) {
                lines.push(`<div style="color:#e74c3c;font-size:11px;margin-top:2px;">已行动</div>`);
            } else if (unit.hasMoved && !unit.hasAttacked) {
                lines.push(`<div style="color:#f39c12;font-size:11px;margin-top:2px;">已移动 / ${uDef.isHealer ? '可治疗' : '可攻击'}</div>`);
            } else if (unit.hasAttacked && !unit.hasMoved) {
                lines.push(`<div style="color:#f39c12;font-size:11px;margin-top:2px;">可移动 / ${uDef.isHealer ? '已治疗' : '已攻击'}</div>`);
            }
        }
    }

    return lines.join('');
}