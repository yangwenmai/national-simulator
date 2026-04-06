// 游戏主逻辑
let gameState;

// 初始化游戏
function initGame() {
    // 初始化画布
    initCanvas();
    
    // 开始新游戏
    startNewGame();
    
    // 初始化界面事件
    initUI();
}

// 开始新游戏
function startNewGame(playerCount = 2, aiPlayerIndices = [], mapSizeKey = null) {
    playerCount = Math.min(Math.max(playerCount, 2), 5);
    
    // 设置地图尺寸
    const sizeKey = mapSizeKey || getRecommendedMapSize(playerCount);
    setMapSize(sizeKey);
    
    initGameState(playerCount, aiPlayerIndices);
    
    gameState.map = initializeMap();
    generateRandomTerrain(gameState.map);
    generatePlayerStartingAreas(gameState.map, playerCount);
    
    for (let i = 0; i < gameState.players.length; i++) {
        syncPlayerBuildings(i);
        updatePlayerIncome(gameState.players[i]);
    }
    
    // 地图初始化完毕后再调整画布并绘制
    resizeCanvas();
    updateGameStateDisplay();
    drawMap();
    
    const aiCount = aiPlayerIndices.length;
    const humanCount = playerCount - aiCount;
    if (aiCount > 0) {
        addLogEntry(`游戏开始！${humanCount}个人类玩家 + ${aiCount}个电脑玩家参与。`);
    } else {
        addLogEntry(`游戏开始！共${playerCount}个玩家参与。`);
    }
    
    // 如果第一个玩家是AI，自动执行AI回合
    if (gameState.players[0].isAI) {
        setTimeout(() => executeAITurn(), 800);
    }
}

// 初始化游戏状态
function initGameState(playerCount, aiPlayerIndices = []) {
    gameState = {
        map: [],
        players: [],
        currentPlayerIndex: 0,
        turn: 1,
        selectedTile: null,
        selectedUnit: null,
        buildMode: false,
        selectedBuildingType: null,
        buildingQueue: [],
        moveMode: false,
        attackMode: false,
        repairMode: false,
        recruitMode: false,
        missileMode: false,
        selectedMissileFactory: null,
        selectedUnitType: null,
        isGameOver: false,
        winner: null,
        factoryProduction: {
            armoryFactoryBuiltThisRound: 0,
            bigArmoryFactoryBuiltThisRound: 0,
            barracksBuiltThisRound: 0,
            hospitalDoctorRecruitKeys: []
        },
        territoryControlMax: 100,
        territoryControlLossPerTurn: 20,
        gameStartTime: Date.now(),
        gameTotalTime: 0,
        currentTurnStartTime: Date.now(),
        playerTurnTimes: [],
        aiExecuting: false
    };
    
    for (let i = 0; i < playerCount; i++) {
        if (i >= PLAYER_COLORS.length) {
            console.error(`警告：没有为玩家${i+1}定义颜色！`);
        }
        
        const isAI = aiPlayerIndices.includes(i);
        
        gameState.players.push({
            id: i,
            name: isAI ? `电脑${i + 1}` : `玩家${i + 1}`,
            color: PLAYER_COLORS[i],
            gold: INITIAL_GOLD,
            income: 0,
            militaryMaintenance: 0,
            buildings: [],
            units: [],
            enchantments: [],
            isDefeated: false,
            isAI: isAI,
            totalTurnTime: 0,
            currentTurnTime: 0,
            turnCount: 0,
            maxTurnTime: 0,
            minTurnTime: Infinity,
            killHistory: []
        });
        
        gameState.playerTurnTimes.push(0);
    }
}

// 处理回合结束
function processEndOfTurn() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 计算当前玩家本回合用时
    const currentTime = Date.now();
    const turnTime = currentTime - gameState.currentTurnStartTime;
    currentPlayer.currentTurnTime = turnTime;
    currentPlayer.totalTurnTime += turnTime;
    gameState.playerTurnTimes[gameState.currentPlayerIndex] = turnTime;
    
    // 更新玩家的回合统计数据
    currentPlayer.turnCount++;  // 增加玩家回合计数
    
    // 更新最长回合用时
    if (turnTime > currentPlayer.maxTurnTime) {
        currentPlayer.maxTurnTime = turnTime;
    }
    
    // 更新最短回合用时（但只有当回合实际进行了一定时间才计算，避免0值）
    if (turnTime > 1000 && turnTime < currentPlayer.minTurnTime) {
        currentPlayer.minTurnTime = turnTime;
    }
    
    // 处理当前玩家的建筑进度
    processBuilding();
    
    // 处理教官战术指导能力
    processInstructorGuidance();
    
    // 处理医院治疗
    processHospitalHealing();
    
    // 处理防御塔自动攻击
    processTowerAttacks();
    
    // 处理油车领地占领能力
    processOilCarAbility();
    
    // 处理魔法兵复活能力
    processMagicSoldierAbility();
    
    // 处理魔法兵的特殊效果
    processMagicSoldierEffect();
    
    // 处理词条效果：生命恢复
    processEnchantmentRegeneration();
    
    // 处理导弹工厂生产
    processMissileProduction();
    
    // 处理海盗船刷新海盗
    processPirateSpawn();
    
    // 处理海盗移动和攻击（海盗会向最近首都移动，沿途攻击单位和建筑）
    processPirateAttack();
    
    // 保存当前玩家建筑到玩家buildings列表
    syncPlayerBuildings(currentPlayer.id);
    
    // 切换到下一个未被击败的玩家
    do {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        
        // 如果回到第一个玩家，增加回合数
        if (gameState.currentPlayerIndex === 0) {
            gameState.turn++;
        }
    } while (gameState.players[gameState.currentPlayerIndex].isDefeated);
    
    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 重置当前回合开始时间
    gameState.currentTurnStartTime = Date.now();
    
    // 重置每个玩家的军事单位招募计数
    gameState.factoryProduction = {
        armoryFactoryBuiltThisRound: 0,
        bigArmoryFactoryBuiltThisRound: 0,
        barracksBuiltThisRound: 0,
        hospitalDoctorRecruitKeys: []
    };
    
    // 处理收入
    nextPlayer.gold += nextPlayer.income;
    
    // 重置单位行动状态
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === nextPlayer.id) {
            tile.unit.hasActed = false;
            tile.unit.hasMoved = false;
            tile.unit.hasAttacked = false;
        }
    }
    
    // 添加回合开始日志
    addLogEntry(`${nextPlayer.name}的回合开始。`);
}

// 同步玩家建筑列表与地图
function syncPlayerBuildings(playerId) {
    const player = gameState.players[playerId];
    
    // 海盗船改为不占领地：旧存档若仅有 ownerId 则迁移到 placedByPlayerId
    for (let i = 0; i < gameState.map.length; i++) {
        const t = gameState.map[i];
        if (t.building && t.building.type === 'pirateShip' &&
            t.building.placedByPlayerId == null && t.ownerId !== null && t.ownerId >= 0) {
            t.building.placedByPlayerId = t.ownerId;
            t.ownerId = null;
        }
    }
    
    // 清空当前建筑列表
    player.buildings = [];
    
    // 从地图重建建筑列表（城市只计入锚点，跳过isCityPart）
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.building && tile.building.isCityPart) continue;
        if (tile.building && tile.building.type === 'pirateShip' &&
            tile.building.placedByPlayerId === playerId) {
            player.buildings.push(tile.building);
            continue;
        }
        if (tile.ownerId === playerId && tile.building) {
            player.buildings.push(tile.building);
        }
    }
}

// 开始建造建筑
function startBuilding(x, y, buildingType) {
    const tileIndex = y * GRID_WIDTH + x;
    const tile = gameState.map[tileIndex];
    const buildingCost = BUILDINGS[buildingType].cost;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 检查是否有足够的金币
    if (currentPlayer.gold < buildingCost) {
        showNotification("金币不足！", "error");
        return false;
    }
    
    // 检查该位置是否已经有建筑进度
    const existingProgress = gameState.buildingQueue.find(bp => bp.x === x && bp.y === y);
    if (existingProgress) {
        showNotification(`该位置已经在建造${BUILDINGS[existingProgress.type].name}！`, "error");
        return false;
    }
    
    // 扣除金币
    currentPlayer.gold -= buildingCost;
    
    // 获取建筑总建造时间（未定义时默认 2；允许 0 表示立即建成）
    let buildTime = BUILDINGS[buildingType].buildTime;
    if (buildTime === undefined || buildTime === null) {
        buildTime = 2;
    }
    
    // 词条：快速建造 - 建造时间减少1回合（最低1回合）；已为 0 的立即建筑不再缩短
    if (
        buildTime > 0 &&
        currentPlayer.enchantments &&
        currentPlayer.enchantments.includes('fastBuild')
    ) {
        buildTime = Math.max(1, buildTime - 1);
    }
    
    if (buildTime <= 0) {
        const ok = buildBuilding(x, y, buildingType, true);
        if (!ok) {
            currentPlayer.gold += buildingCost;
            return false;
        }
        return true;
    }
    
    // 创建新的建筑进度并添加到队列
    const buildingProgress = {
        x: x,
        y: y,
        type: buildingType,
        progress: 0,
        totalTime: buildTime,
        ownerId: currentPlayer.id // 记录建造者ID
    };
    
    // 将建筑添加到队列
    gameState.buildingQueue.push(buildingProgress);
    
    // 添加游戏日志
    addLogEntry(`${currentPlayer.name}开始在坐标(${x}, ${y})建造${BUILDINGS[buildingType].name}，花费${buildingCost}金币。`);
    
    // 显示通知
    showNotification(`开始建造${BUILDINGS[buildingType].name}，将在${buildTime}回合后完成。`);
    
    return true;
}

// 处理建筑进度
function processBuilding() {
    // 如果没有建筑队列或队列为空，直接返回
    if (!gameState.buildingQueue || gameState.buildingQueue.length === 0) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 找出当前玩家的所有建筑进度
    const playerBuildings = gameState.buildingQueue.filter(bp => bp.ownerId === currentPlayer.id);
    
    // 如果当前玩家没有正在建造的建筑，直接返回
    if (playerBuildings.length === 0) return;
    
    let uiNeedsUpdate = false;
    
    // 处理每个建筑进度
    for (let i = playerBuildings.length - 1; i >= 0; i--) {
        const progress = playerBuildings[i];
        
        // 确保totalTime存在，默认为2
        const totalTime = progress.totalTime || 2;
        
        // 增加建造进度 (每回合进度 = 100% / 总回合数)
        progress.progress += (100 / totalTime);
        
        // 检查是否建造完成
        if (progress.progress >= 100) {
            // 暂存当前玩家索引
            const originalPlayerIndex = gameState.currentPlayerIndex;
            
            // 临时设置当前玩家为建筑所有者，确保建筑正确分配
            gameState.currentPlayerIndex = progress.ownerId;
            
            if (progress.isCity) {
                // 城市2x2建造完成
                buildCity(progress.x, progress.y, progress.ownerId);
            } else {
                // 普通建筑建造完成
                buildBuilding(progress.x, progress.y, progress.type, true);
            }
            
            // 恢复原始玩家索引
            gameState.currentPlayerIndex = originalPlayerIndex;
            
            // 从队列中移除该建筑进度
            const index = gameState.buildingQueue.indexOf(progress);
            if (index !== -1) {
                gameState.buildingQueue.splice(index, 1);
            }
            
            // 同步建造者的建筑数据
            syncPlayerBuildings(progress.ownerId);
            
            uiNeedsUpdate = true;
        }
    }
    
    // 只在需要时更新UI
    if (uiNeedsUpdate) {
        // 更新UI
        updateGameStateDisplay();
        drawMap();
    }
}

// 处理防御塔自动攻击
function processTowerAttacks() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let attackHappened = false;
    
    // 查找当前玩家的所有防御塔
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        
        // 检查是否是当前玩家的防御塔
        if (tile.ownerId === currentPlayer.id && 
            tile.building && 
            tile.building.type === 'tower') {
            
            // 查找攻击范围内的敌方单位
            const attackRange = BUILDINGS.tower.attackRange;
            let nearestEnemy = null;
            let nearestDistance = Infinity;
            
            for (let j = 0; j < gameState.map.length; j++) {
                const targetTile = gameState.map[j];
                
                // 检查是否有敌方单位
                if (targetTile.unit && targetTile.unit.ownerId !== currentPlayer.id) {
                    // 计算距离
                    const distance = manhattanDistance(tile.x, tile.y, targetTile.x, targetTile.y);
                    
                    // 检查是否在攻击范围内
                    if (distance <= attackRange && distance < nearestDistance) {
                        nearestEnemy = targetTile;
                        nearestDistance = distance;
                    }
                }
            }
            
            // 如果找到敌方单位，进行攻击
            if (nearestEnemy) {
                attackHappened = true;
                const damage = BUILDINGS.tower.attack;
                const enemy = nearestEnemy.unit;
                const enemyPlayer = gameState.players[enemy.ownerId];
                
                // 应用伤害
                enemy.health -= damage;
                
                // 检查敌方单位是否被摧毁
                if (enemy.health <= 0) {
                    // 添加游戏日志
                    addLogEntry(`${currentPlayer.name}的防御塔摧毁了${gameState.players[enemy.ownerId].name}的${UNITS[enemy.type].name}，造成了${damage}点伤害。`);
                    
                    // 从玩家单位列表中删除被摧毁的单位
                    const unitIndex = enemyPlayer.units.findIndex(u => u.id === enemy.id);
                    if (unitIndex !== -1) {
                        enemyPlayer.units.splice(unitIndex, 1);
                    }
                    
                    // 移除被摧毁的单位
                    nearestEnemy.unit = null;
                    
                    // 嗜血狂魔解锁：防御塔击杀计入累计消灭数
                    recordPlayerKill(currentPlayer.id);
                    
                    // 检查玩家是否已经失败
                    checkPlayerDefeat(enemy.ownerId);
                } else {
                    // 添加游戏日志
                    addLogEntry(`${currentPlayer.name}的防御塔攻击了${gameState.players[enemy.ownerId].name}的${UNITS[enemy.type].name}，造成了${damage}点伤害。`);
                }
            }
        }
    }
    
    // 如果发生了攻击，更新游戏状态
    if (attackHappened) {
        updateGameStateDisplay();
        drawMap();
    }
}

// 更新玩家收入
function updatePlayerIncome(player) {
    let totalIncome = 0;
    let militaryMaintenance = 0;
    let knowledgeIncome = 0;
    
    // 计算建筑收入和维护费
    for (let i = 0; i < player.buildings.length; i++) {
        const building = player.buildings[i];
        const buildingType = building.type;
        
        if (BUILDINGS[buildingType].income > 0) {
            // 经济建筑
            let baseIncome = BUILDINGS[buildingType].income;
            
            // 贸易站随机收入 (40-60)
            if (buildingType === 'tradingPost' && BUILDINGS[buildingType].randomIncome) {
                const { min, max } = BUILDINGS[buildingType].randomIncome;
                baseIncome = min + Math.floor(Math.random() * (max - min + 1));
                building.lastRandomIncome = baseIncome;
            }
            
            // 城市随机收入 (-30~100)，只算锚点避免重复
            if (buildingType === 'city' && building.isCityAnchor && BUILDINGS.city.randomIncome) {
                const { min, max } = BUILDINGS.city.randomIncome;
                baseIncome = min + Math.floor(Math.random() * (max - min + 1));
                building.lastRandomIncome = baseIncome;
            }
            
            // 城市非锚点部分不计算收入
            if (buildingType === 'city' && building.isCityPart) {
                continue;
            }
            
            // 考虑建筑健康状况
            const healthPercent = building.health / BUILDINGS[buildingType].maxHealth;
            let incomeMultiplier;
            
            if (healthPercent > 0.7) {
                incomeMultiplier = 1.0; // 健康 - 正常收入
            } else if (healthPercent > 0.3) {
                incomeMultiplier = 0.7; // 受损 - 收入降低30%
            } else {
                incomeMultiplier = 0.4; // 严重受损 - 收入降低60%
            }
            
            // 词条：经济繁荣 - 经济建筑收入+25%
            let enchantmentMultiplier = 1.0;
            if (player.enchantments && player.enchantments.includes('economicBoom')) {
                enchantmentMultiplier = 1.25;
            }
            
            totalIncome += Math.round(baseIncome * incomeMultiplier * enchantmentMultiplier);
        } else if (BUILDINGS[buildingType].income < 0) {
            // 军事/防御/支援建筑 - 维护费
            militaryMaintenance += Math.abs(BUILDINGS[buildingType].income);
        }
        
        // 处理图书馆的知识收益
        if (buildingType === 'library' && BUILDINGS[buildingType].knowledgeIncome) {
            knowledgeIncome += BUILDINGS[buildingType].knowledgeIncome;
        }
    }
    
    // 计算单位维护费
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === player.id) {
            // 直接招募的单位没有维护费用
        }
    }
    
    // 词条：淘金热 - 额外+80金币
    if (player.enchantments && player.enchantments.includes('goldRush')) {
        totalIncome += 80;
    }
    
    // 更新玩家收入和军事维护费
    player.income = totalIncome - militaryMaintenance + knowledgeIncome;
    player.militaryMaintenance = militaryMaintenance;
    
    // 更新UI显示
    updateResourceDisplay();
}

// 建造建筑
function buildBuilding(x, y, buildingType, isFromProgress = false) {
    const tileIndex = y * GRID_WIDTH + x;
    const tile = gameState.map[tileIndex];
    const buildingCost = BUILDINGS[buildingType].cost;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 检查建筑是否能被直接建造
    if (!isFromProgress && BUILDINGS[buildingType].cannotBuildDirectly) {
        showNotification(`${BUILDINGS[buildingType].name}不能直接建造！`, "error");
        return false;
    }
    
    // 检查是否有足够的金币（仅当不是从建筑进度完成时检查）
    if (!isFromProgress && currentPlayer.gold < buildingCost) {
        showNotification("金币不足！", "error");
        return false;
    }
    
    // 仅当不是从建筑进度完成时扣除金币
    if (!isFromProgress) {
        currentPlayer.gold -= buildingCost;
    }
    
    // 创建唯一ID
    const buildingId = generateBuildingId();
    
    // 建立建筑
    const newBuilding = {
        type: buildingType,
        name: BUILDINGS[buildingType].name,
        income: BUILDINGS[buildingType].income,
        health: BUILDINGS[buildingType].maxHealth,
        id: buildingId
    };
    
    // 如果是图书馆，添加知识收益属性
    if (buildingType === 'library' && BUILDINGS[buildingType].knowledgeIncome) {
        newBuilding.knowledgeIncome = BUILDINGS[buildingType].knowledgeIncome;
    }
    
    // 如果是导弹工厂，初始化导弹存储属性
    if (buildingType === 'missileFactory') {
        newBuilding.storedMissiles = 0;
        newBuilding.missileBuilding = false;
        newBuilding.missileBuildTurns = 0;
    }
    
    // 如果是海盗船，初始化刷新计时器，并记录建造者（格子不设为玩家领地）
    if (buildingType === 'pirateShip') {
        newBuilding.pirateSpawnTimer = 0;
        newBuilding.placedByPlayerId = currentPlayer.id;
    }
    
    // 设置到地图上
    tile.building = newBuilding;
    
    // 海盗船所在水域不属于任何玩家领地
    if (buildingType === 'pirateShip') {
        tile.ownerId = null;
    }
    
    // 更新玩家的收入
    updatePlayerIncome(currentPlayer);
    
    // 添加到玩家建筑列表
    currentPlayer.buildings.push(newBuilding);
    
    // 扩张领土（海盗船不扩张领地）
    if (buildingType !== 'pirateShip') {
        const bDef = BUILDINGS[buildingType];
        const expandOpts =
            bDef && bDef.fixedTerritoryRadius != null ? { fixedRadius: bDef.fixedTerritoryRadius } : undefined;
        const { claimedCells } = expandTerritory(x, y, currentPlayer.id, expandOpts);
        if (buildingType === 'territoryExpander' && claimedCells && claimedCells.length > 0) {
            newBuilding.expanderClaimedCells = claimedCells.slice();
        }
    }
    
    // 添加游戏日志
    addLogEntry(`${currentPlayer.name}在坐标(${x}, ${y})建造了${BUILDINGS[buildingType].name}，花费${buildingCost}金币。`);
    
    // 显示通知
    showNotification(`建造${BUILDINGS[buildingType].name}成功！`);
    
    return true;
}

// 处理医院治疗单位（仅当己方军事单位站在医院格上时恢复）
function processHospitalHealing() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const smallStep = 20;
    
    gameState.map.forEach(tile => {
        if (tile.ownerId !== currentPlayer.id || !tile.building || !tile.unit) return;
        if (tile.unit.ownerId !== currentPlayer.id) return;
        
        const u = tile.unit;
        const def = UNITS[u.type];
        if (!def || def.isNeutral) return;
        
        const maxH = u.maxHealth || def.health;
        if (u.health >= maxH) return;
        
        if (tile.building.type === 'hospital') {
            const before = u.health;
            healUnit(u, smallStep);
            addLogEntry(`${currentPlayer.name}的医院为站在院内的${def.name}恢复了${u.health - before}点生命值。`);
        } else if (tile.building.type === 'bigHospital') {
            let healsRemaining = 3;
            let totalGain = 0;
            while (healsRemaining > 0 && u.health < maxH) {
                const before = u.health;
                healUnit(u, smallStep);
                totalGain += u.health - before;
                healsRemaining--;
            }
            if (totalGain > 0) {
                addLogEntry(`${currentPlayer.name}的大型医院为站在院内的${def.name}恢复了${totalGain}点生命值。`);
            }
        }
    });
}

// 治疗单位
function healUnit(unit, amount) {
    const maxHealth = unit.maxHealth || UNITS[unit.type].health;
    unit.health = Math.min(unit.health + amount, maxHealth);
}

// 显示游戏结束画面
function showGameOverScreen(winner) {
    // 创建胜利弹窗
    const victoryOverlay = document.createElement('div');
    victoryOverlay.style.position = 'fixed';
    victoryOverlay.style.top = '0';
    victoryOverlay.style.left = '0';
    victoryOverlay.style.width = '100%';
    victoryOverlay.style.height = '100%';
    victoryOverlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
    victoryOverlay.style.display = 'flex';
    victoryOverlay.style.flexDirection = 'column';
    victoryOverlay.style.justifyContent = 'flex-start';
    victoryOverlay.style.alignItems = 'center';
    victoryOverlay.style.zIndex = '1000';
    victoryOverlay.style.overflowY = 'auto';
    victoryOverlay.style.padding = '20px 0';
    
    const victoryBox = document.createElement('div');
    victoryBox.style.backgroundColor = '#fff';
    victoryBox.style.padding = '20px';
    victoryBox.style.borderRadius = '10px';
    victoryBox.style.width = '90%';
    victoryBox.style.maxWidth = '1200px';
    victoryBox.style.marginBottom = '20px';
    
    // 添加胜利标题
    const victoryTitle = document.createElement('h2');
    victoryTitle.textContent = '胜利!';
    victoryTitle.style.color = winner.color.main;
    victoryTitle.style.fontSize = '32px';
    victoryTitle.style.textAlign = 'center';
    victoryTitle.style.marginBottom = '10px';
    
    // 添加胜利描述
    const victoryDesc = document.createElement('p');
    victoryDesc.innerHTML = `${winner.name}获得了胜利！`;
    victoryDesc.style.fontSize = '18px';
    victoryDesc.style.textAlign = 'center';
    victoryDesc.style.marginBottom = '5px';
    
    // 添加游戏时长信息
    const gameDuration = Math.floor(gameState.gameTotalTime / 1000);
    const hours = Math.floor(gameDuration / 3600);
    const minutes = Math.floor((gameDuration % 3600) / 60);
    const seconds = gameDuration % 60;
    const timeStr = `${hours}小时${minutes}分${seconds}秒`;
    
    const gameTimeInfo = document.createElement('p');
    gameTimeInfo.innerHTML = `游戏总时长：<strong>${timeStr}</strong>，总回合数：<strong>${gameState.turn}</strong>`;
    gameTimeInfo.style.fontSize = '14px';
    gameTimeInfo.style.textAlign = 'center';
    gameTimeInfo.style.marginBottom = '20px';
    
    // 创建一个flex布局的容器来放置得分表和详细统计
    const contentContainer = document.createElement('div');
    contentContainer.style.display = 'flex';
    contentContainer.style.flexDirection = 'column';
    contentContainer.style.width = '100%';
    contentContainer.style.gap = '20px';
    
    // 添加玩家得分表（简要总览）
    const scoreTableContainer = document.createElement('div');
    scoreTableContainer.style.width = '100%';
    
    const scoreTableTitle = document.createElement('h3');
    scoreTableTitle.textContent = '玩家排名';
    scoreTableTitle.style.textAlign = 'center';
    scoreTableTitle.style.marginBottom = '10px';
    scoreTableTitle.style.padding = '5px';
    scoreTableTitle.style.backgroundColor = '#f5f5f5';
    scoreTableTitle.style.borderRadius = '4px';
    
    const scoreTable = document.createElement('table');
    scoreTable.style.width = '100%';
    scoreTable.style.borderCollapse = 'collapse';
    scoreTable.style.marginBottom = '15px';
    
    // 创建表头
    const tableHeader = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f0f0f0';
    
    const headers = ['排名', '玩家', '得分', '金币', '收入', '领土', '建筑', '单位'];
    
    headers.forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        header.style.padding = '8px';
        header.style.textAlign = headerText === '玩家' ? 'left' : 'center';
        header.style.borderBottom = '2px solid #ddd';
        headerRow.appendChild(header);
    });
    
    tableHeader.appendChild(headerRow);
    scoreTable.appendChild(tableHeader);
    
    const tableBody = document.createElement('tbody');
    
    // 给每个玩家计算得分
    const playerScores = [];
    for (const player of gameState.players) {
        if (player.isDefeated) continue;
        
        let score = 0;
        // 计算建筑得分
        score += player.buildings.length * 10;
        // 计算单位得分
        score += player.units.length * 5;
        // 计算金币得分
        score += Math.floor(player.gold / 10);
        // 计算收入得分
        score += player.income * 5;
        
        // 计算领土数
        const territoryCount = gameState.map.filter(tile => 
            tile.ownerId === player.id
        ).length;
        
        playerScores.push({
            playerId: player.id,
            score: score,
            gold: player.gold,
            income: player.income,
            territory: territoryCount,
            buildings: player.buildings.length,
            units: player.units.length
        });
    }
    
    // 排序得分
    playerScores.sort((a, b) => b.score - a.score);
    
    // 显示得分表格
    playerScores.forEach((playerScore, index) => {
        const player = gameState.players[playerScore.playerId];
        const scoreRow = document.createElement('tr');
        scoreRow.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        if (index === 0) scoreRow.style.backgroundColor = '#fffde7';
        
        // 排名列
        const rankCell = document.createElement('td');
        rankCell.textContent = `#${index + 1}`;
        rankCell.style.fontWeight = 'bold';
        rankCell.style.textAlign = 'center';
        rankCell.style.padding = '8px';
        
        // 玩家名列
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        
        // 得分列
        const scoreCell = document.createElement('td');
        scoreCell.textContent = formatNumber(playerScore.score);
        scoreCell.style.textAlign = 'center';
        scoreCell.style.fontWeight = index === 0 ? 'bold' : 'normal';
        scoreCell.style.padding = '8px';
        
        // 金币列
        const goldCell = document.createElement('td');
        goldCell.textContent = formatNumber(playerScore.gold);
        goldCell.style.textAlign = 'center';
        goldCell.style.padding = '8px';
        
        // 收入列
        const incomeCell = document.createElement('td');
        incomeCell.textContent = formatNumber(playerScore.income);
        incomeCell.style.textAlign = 'center';
        incomeCell.style.padding = '8px';
        
        // 领土列
        const territoryCell = document.createElement('td');
        territoryCell.textContent = formatNumber(playerScore.territory);
        territoryCell.style.textAlign = 'center';
        territoryCell.style.padding = '8px';
        
        // 建筑列
        const buildingsCell = document.createElement('td');
        buildingsCell.textContent = formatNumber(playerScore.buildings);
        buildingsCell.style.textAlign = 'center';
        buildingsCell.style.padding = '8px';
        
        // 单位列
        const unitsCell = document.createElement('td');
        unitsCell.textContent = formatNumber(playerScore.units);
        unitsCell.style.textAlign = 'center';
        unitsCell.style.padding = '8px';
        
        scoreRow.appendChild(rankCell);
        scoreRow.appendChild(playerCell);
        scoreRow.appendChild(scoreCell);
        scoreRow.appendChild(goldCell);
        scoreRow.appendChild(incomeCell);
        scoreRow.appendChild(territoryCell);
        scoreRow.appendChild(buildingsCell);
        scoreRow.appendChild(unitsCell);
        
        tableBody.appendChild(scoreRow);
    });
    
    scoreTable.appendChild(tableBody);
    scoreTableContainer.appendChild(scoreTableTitle);
    scoreTableContainer.appendChild(scoreTable);
    
    contentContainer.appendChild(scoreTableContainer);
    
    // 添加玩家详细统计数据标题
    const detailedStatsTitle = document.createElement('h3');
    detailedStatsTitle.textContent = '玩家详细统计';
    detailedStatsTitle.style.textAlign = 'center';
    detailedStatsTitle.style.marginBottom = '15px';
    detailedStatsTitle.style.padding = '5px';
    detailedStatsTitle.style.backgroundColor = '#f5f5f5';
    detailedStatsTitle.style.borderRadius = '4px';
    
    // 创建Tab选项容器
    const tabsContainer = document.createElement('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.justifyContent = 'center';
    tabsContainer.style.marginBottom = '15px';
    tabsContainer.style.borderBottom = '1px solid #ddd';
    
    const tabOptions = ['经济', '军事', '建筑', '时间'];
    const tabPanels = {};
    let activeTab = '经济';
    
    // 为每个Tab创建面板容器
    tabOptions.forEach(tab => {
        const tabPanel = document.createElement('div');
        tabPanel.style.display = tab === activeTab ? 'block' : 'none';
        tabPanel.style.width = '100%';
        tabPanels[tab] = tabPanel;
    });
    
    // 创建Tab按钮
    tabOptions.forEach(tab => {
        const tabButton = document.createElement('button');
        tabButton.textContent = tab;
        tabButton.style.padding = '8px 15px';
        tabButton.style.margin = '0 5px';
        tabButton.style.border = 'none';
        tabButton.style.borderBottom = tab === activeTab ? '3px solid #4CAF50' : '3px solid transparent';
        tabButton.style.backgroundColor = 'transparent';
        tabButton.style.cursor = 'pointer';
        tabButton.style.fontWeight = tab === activeTab ? 'bold' : 'normal';
        tabButton.style.color = tab === activeTab ? '#4CAF50' : '#333';
        
        tabButton.addEventListener('click', () => {
            // 更新激活状态
            activeTab = tab;
            
            // 更新所有Tab按钮样式
            tabsContainer.childNodes.forEach(btn => {
                btn.style.borderBottom = '3px solid transparent';
                btn.style.fontWeight = 'normal';
                btn.style.color = '#333';
            });
            
            tabButton.style.borderBottom = '3px solid #4CAF50';
            tabButton.style.fontWeight = 'bold';
            tabButton.style.color = '#4CAF50';
            
            // 显示当前Tab面板，隐藏其他
            Object.keys(tabPanels).forEach(key => {
                tabPanels[key].style.display = key === tab ? 'block' : 'none';
            });
        });
        
        tabsContainer.appendChild(tabButton);
    });
    
    // 创建统计数据容器
    const statsContainer = document.createElement('div');
    statsContainer.style.display = 'flex';
    statsContainer.style.flexWrap = 'wrap';
    statsContainer.style.justifyContent = 'center';
    statsContainer.style.gap = '20px';
    
    // 1. 经济Tab面板
    const economyPanel = tabPanels['经济'];
    
    // 创建经济比较表格
    const economyTable = document.createElement('table');
    economyTable.style.width = '100%';
    economyTable.style.borderCollapse = 'collapse';
    economyTable.style.marginBottom = '20px';
    
    // 创建表头
    const economyHeader = document.createElement('thead');
    const economyHeaderRow = document.createElement('tr');
    economyHeaderRow.style.backgroundColor = '#f0f0f0';
    
    const economyHeaders = ['玩家', '最终金币', '收入/回合', '经济建筑数', '总财富', '领地数量'];
    
    economyHeaders.forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        header.style.padding = '8px';
        header.style.textAlign = headerText === '玩家' ? 'left' : 'center';
        header.style.borderBottom = '2px solid #ddd';
        economyHeaderRow.appendChild(header);
    });
    
    economyHeader.appendChild(economyHeaderRow);
    economyTable.appendChild(economyHeader);
    
    const economyBody = document.createElement('tbody');
    
    // 排序玩家（按财富）
    const playersByWealth = [...playerScores].sort((a, b) => 
        (b.gold + b.buildings * 200 + b.units * 150) - 
        (a.gold + a.buildings * 200 + a.units * 150)
    );
    
    playersByWealth.forEach((playerScore, index) => {
        const player = gameState.players[playerScore.playerId];
        
        // 计算经济建筑数
        const economyBuildingCount = player.buildings.filter(building => 
            BUILDINGS[building.type]?.category === 'economy'
        ).length;
        
        // 计算总财富
        const totalWealth = player.gold + player.buildings.length * 200 + player.units.length * 150;
        
        const row = document.createElement('tr');
        row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        
        // 玩家名
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        
        // 最终金币
        const goldCell = document.createElement('td');
        goldCell.textContent = formatNumber(player.gold);
        goldCell.style.textAlign = 'center';
        goldCell.style.padding = '8px';
        
        // 收入/回合
        const incomeCell = document.createElement('td');
        incomeCell.textContent = formatNumber(player.income);
        incomeCell.style.textAlign = 'center';
        incomeCell.style.padding = '8px';
        
        // 经济建筑数
        const econBuildingsCell = document.createElement('td');
        econBuildingsCell.textContent = economyBuildingCount;
        econBuildingsCell.style.textAlign = 'center';
        econBuildingsCell.style.padding = '8px';
        
        // 总财富
        const wealthCell = document.createElement('td');
        wealthCell.textContent = formatNumber(totalWealth);
        wealthCell.style.textAlign = 'center';
        wealthCell.style.padding = '8px';
        
        // 领地数量
        const territoryCell = document.createElement('td');
        territoryCell.textContent = formatNumber(playerScore.territory);
        territoryCell.style.textAlign = 'center';
        territoryCell.style.padding = '8px';
        
        row.appendChild(playerCell);
        row.appendChild(goldCell);
        row.appendChild(incomeCell);
        row.appendChild(econBuildingsCell);
        row.appendChild(wealthCell);
        row.appendChild(territoryCell);
        
        economyBody.appendChild(row);
    });
    
    economyTable.appendChild(economyBody);
    economyPanel.appendChild(economyTable);
    
    // 2. 军事Tab面板
    const militaryPanel = tabPanels['军事'];
    
    // 创建军事比较表格
    const militaryTable = document.createElement('table');
    militaryTable.style.width = '100%';
    militaryTable.style.borderCollapse = 'collapse';
    militaryTable.style.marginBottom = '20px';
    
    // 创建表头
    const militaryHeader = document.createElement('thead');
    const militaryHeaderRow = document.createElement('tr');
    militaryHeaderRow.style.backgroundColor = '#f0f0f0';
    
    const militaryHeaders = ['玩家', '总单位数', '地面单位', '空中单位', '特殊单位', '军事建筑'];
    
    militaryHeaders.forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        header.style.padding = '8px';
        header.style.textAlign = headerText === '玩家' ? 'left' : 'center';
        header.style.borderBottom = '2px solid #ddd';
        militaryHeaderRow.appendChild(header);
    });
    
    militaryHeader.appendChild(militaryHeaderRow);
    militaryTable.appendChild(militaryHeader);
    
    const militaryBody = document.createElement('tbody');
    
    // 排序玩家（按单位数）
    const playersByMilitary = [...playerScores].sort((a, b) => b.units - a.units);
    
    playersByMilitary.forEach((playerScore, index) => {
        const player = gameState.players[playerScore.playerId];
        
        // 计算不同类型的单位数量
        const groundUnits = player.units.filter(unit => 
            UNITS[unit.type]?.type === 'ground'
        ).length;
        
        const airUnits = player.units.filter(unit => 
            UNITS[unit.type]?.type === 'air'
        ).length;
        
        const specialUnits = player.units.filter(unit => 
            UNITS[unit.type]?.type === 'special'
        ).length;
        
        // 计算军事建筑数
        const militaryBuildings = player.buildings.filter(building => 
            BUILDINGS[building.type]?.category === 'military'
        ).length;
        
        const row = document.createElement('tr');
        row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        
        // 玩家名
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        
        // 总单位数
        const unitsCell = document.createElement('td');
        unitsCell.textContent = player.units.length;
        unitsCell.style.textAlign = 'center';
        unitsCell.style.padding = '8px';
        
        // 地面单位
        const groundCell = document.createElement('td');
        groundCell.textContent = groundUnits;
        groundCell.style.textAlign = 'center';
        groundCell.style.padding = '8px';
        
        // 空中单位
        const airCell = document.createElement('td');
        airCell.textContent = airUnits;
        airCell.style.textAlign = 'center';
        airCell.style.padding = '8px';
        
        // 特殊单位
        const specialCell = document.createElement('td');
        specialCell.textContent = specialUnits;
        specialCell.style.textAlign = 'center';
        specialCell.style.padding = '8px';
        
        // 军事建筑
        const militaryBuildingsCell = document.createElement('td');
        militaryBuildingsCell.textContent = militaryBuildings;
        militaryBuildingsCell.style.textAlign = 'center';
        militaryBuildingsCell.style.padding = '8px';
        
        row.appendChild(playerCell);
        row.appendChild(unitsCell);
        row.appendChild(groundCell);
        row.appendChild(airCell);
        row.appendChild(specialCell);
        row.appendChild(militaryBuildingsCell);
        
        militaryBody.appendChild(row);
    });
    
    militaryTable.appendChild(militaryBody);
    militaryPanel.appendChild(militaryTable);
    
    // 添加单位类型对比表格
    const unitTypesTitle = document.createElement('h4');
    unitTypesTitle.textContent = '单位类型详情';
    unitTypesTitle.style.textAlign = 'center';
    unitTypesTitle.style.margin = '15px 0 10px 0';
    militaryPanel.appendChild(unitTypesTitle);
    
    const unitTypesTable = document.createElement('table');
    unitTypesTable.style.width = '100%';
    unitTypesTable.style.borderCollapse = 'collapse';
    
    // 收集所有单位类型
    const allUnitTypes = new Set();
    gameState.players.forEach(player => {
        if (player.isDefeated) return;
        player.units.forEach(unit => {
            allUnitTypes.add(unit.type);
        });
    });
    
    // 创建表头
    const unitTypesHeader = document.createElement('thead');
    const unitTypesHeaderRow = document.createElement('tr');
    unitTypesHeaderRow.style.backgroundColor = '#f0f0f0';
    
    // 添加玩家列
    const playerHeader = document.createElement('th');
    playerHeader.textContent = '玩家';
    playerHeader.style.padding = '8px';
    playerHeader.style.textAlign = 'left';
    playerHeader.style.borderBottom = '2px solid #ddd';
    unitTypesHeaderRow.appendChild(playerHeader);
    
    // 添加每种单位类型列
    [...allUnitTypes].sort().forEach(unitType => {
        if (UNITS[unitType]) {
            const header = document.createElement('th');
            header.textContent = UNITS[unitType].name;
            header.style.padding = '8px';
            header.style.textAlign = 'center';
            header.style.borderBottom = '2px solid #ddd';
            unitTypesHeaderRow.appendChild(header);
        }
    });
    
    unitTypesHeader.appendChild(unitTypesHeaderRow);
    unitTypesTable.appendChild(unitTypesHeader);
    
    const unitTypesBody = document.createElement('tbody');
    
    // 添加每个玩家的单位类型统计
    gameState.players.forEach((player, index) => {
        if (player.isDefeated) return;
        
        const row = document.createElement('tr');
        row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        
        // 玩家名
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        row.appendChild(playerCell);
        
        // 统计每种单位类型的数量
        const unitTypeCount = {};
        player.units.forEach(unit => {
            unitTypeCount[unit.type] = (unitTypeCount[unit.type] || 0) + 1;
        });
        
        // 添加每种单位类型的数量
        [...allUnitTypes].sort().forEach(unitType => {
            const cell = document.createElement('td');
            cell.textContent = unitTypeCount[unitType] || 0;
            cell.style.textAlign = 'center';
            cell.style.padding = '8px';
            row.appendChild(cell);
        });
        
        unitTypesBody.appendChild(row);
    });
    
    unitTypesTable.appendChild(unitTypesBody);
    militaryPanel.appendChild(unitTypesTable);
    
    // 3. 建筑Tab面板
    const buildingPanel = tabPanels['建筑'];
    
    // 创建建筑比较表格
    const buildingTable = document.createElement('table');
    buildingTable.style.width = '100%';
    buildingTable.style.borderCollapse = 'collapse';
    buildingTable.style.marginBottom = '20px';
    
    // 创建表头
    const buildingHeader = document.createElement('thead');
    const buildingHeaderRow = document.createElement('tr');
    buildingHeaderRow.style.backgroundColor = '#f0f0f0';
    
    const buildingHeaders = ['玩家', '总建筑数', '经济建筑', '军事建筑', '防御建筑', '支援建筑', '特殊建筑'];
    
    buildingHeaders.forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        header.style.padding = '8px';
        header.style.textAlign = headerText === '玩家' ? 'left' : 'center';
        header.style.borderBottom = '2px solid #ddd';
        buildingHeaderRow.appendChild(header);
    });
    
    buildingHeader.appendChild(buildingHeaderRow);
    buildingTable.appendChild(buildingHeader);
    
    const buildingBody = document.createElement('tbody');
    
    // 排序玩家（按建筑数）
    const playersByBuildings = [...playerScores].sort((a, b) => b.buildings - a.buildings);
    
    playersByBuildings.forEach((playerScore, index) => {
        const player = gameState.players[playerScore.playerId];
        
        // 统计各类别建筑
        const buildingCounts = {
            economy: 0,
            military: 0,
            defense: 0,
            support: 0,
            special: 0
        };
        
        player.buildings.forEach(building => {
            const category = BUILDINGS[building.type]?.category;
            if (category && buildingCounts[category] !== undefined) {
                buildingCounts[category]++;
            }
        });
        
        const row = document.createElement('tr');
        row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        
        // 玩家名
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        
        // 总建筑数
        const totalCell = document.createElement('td');
        totalCell.textContent = player.buildings.length;
        totalCell.style.textAlign = 'center';
        totalCell.style.padding = '8px';
        
        // 各类别建筑数
        const economyCell = document.createElement('td');
        economyCell.textContent = buildingCounts.economy;
        economyCell.style.textAlign = 'center';
        economyCell.style.padding = '8px';
        
        const militaryCell = document.createElement('td');
        militaryCell.textContent = buildingCounts.military;
        militaryCell.style.textAlign = 'center';
        militaryCell.style.padding = '8px';
        
        const defenseCell = document.createElement('td');
        defenseCell.textContent = buildingCounts.defense;
        defenseCell.style.textAlign = 'center';
        defenseCell.style.padding = '8px';
        
        const supportCell = document.createElement('td');
        supportCell.textContent = buildingCounts.support;
        supportCell.style.textAlign = 'center';
        supportCell.style.padding = '8px';
        
        const specialCell = document.createElement('td');
        specialCell.textContent = buildingCounts.special;
        specialCell.style.textAlign = 'center';
        specialCell.style.padding = '8px';
        
        row.appendChild(playerCell);
        row.appendChild(totalCell);
        row.appendChild(economyCell);
        row.appendChild(militaryCell);
        row.appendChild(defenseCell);
        row.appendChild(supportCell);
        row.appendChild(specialCell);
        
        buildingBody.appendChild(row);
    });
    
    buildingTable.appendChild(buildingBody);
    buildingPanel.appendChild(buildingTable);
    
    // 添加建筑类型对比表格
    const buildingTypesTitle = document.createElement('h4');
    buildingTypesTitle.textContent = '建筑类型详情';
    buildingTypesTitle.style.textAlign = 'center';
    buildingTypesTitle.style.margin = '15px 0 10px 0';
    buildingPanel.appendChild(buildingTypesTitle);
    
    const buildingTypesTable = document.createElement('table');
    buildingTypesTable.style.width = '100%';
    buildingTypesTable.style.borderCollapse = 'collapse';
    
    // 收集所有建筑类型
    const allBuildingTypes = new Set();
    gameState.players.forEach(player => {
        if (player.isDefeated) return;
        player.buildings.forEach(building => {
            allBuildingTypes.add(building.type);
        });
    });
    
    // 创建表头
    const buildingTypesHeader = document.createElement('thead');
    const buildingTypesHeaderRow = document.createElement('tr');
    buildingTypesHeaderRow.style.backgroundColor = '#f0f0f0';
    
    // 添加玩家列
    const buildingPlayerHeader = document.createElement('th');
    buildingPlayerHeader.textContent = '玩家';
    buildingPlayerHeader.style.padding = '8px';
    buildingPlayerHeader.style.textAlign = 'left';
    buildingPlayerHeader.style.borderBottom = '2px solid #ddd';
    buildingTypesHeaderRow.appendChild(buildingPlayerHeader);
    
    // 添加每种建筑类型列
    [...allBuildingTypes].sort().forEach(buildingType => {
        if (BUILDINGS[buildingType]) {
            const header = document.createElement('th');
            header.textContent = BUILDINGS[buildingType].name;
            header.style.padding = '8px';
            header.style.textAlign = 'center';
            header.style.borderBottom = '2px solid #ddd';
            buildingTypesHeaderRow.appendChild(header);
        }
    });
    
    buildingTypesHeader.appendChild(buildingTypesHeaderRow);
    buildingTypesTable.appendChild(buildingTypesHeader);
    
    const buildingTypesBody = document.createElement('tbody');
    
    // 添加每个玩家的建筑类型统计
    gameState.players.forEach((player, index) => {
        if (player.isDefeated) return;
        
        const row = document.createElement('tr');
        row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        
        // 玩家名
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        row.appendChild(playerCell);
        
        // 统计每种建筑类型的数量
        const buildingTypeCount = {};
        player.buildings.forEach(building => {
            buildingTypeCount[building.type] = (buildingTypeCount[building.type] || 0) + 1;
        });
        
        // 添加每种建筑类型的数量
        [...allBuildingTypes].sort().forEach(buildingType => {
            const cell = document.createElement('td');
            cell.textContent = buildingTypeCount[buildingType] || 0;
            cell.style.textAlign = 'center';
            cell.style.padding = '8px';
            row.appendChild(cell);
        });
        
        buildingTypesBody.appendChild(row);
    });
    
    buildingTypesTable.appendChild(buildingTypesBody);
    buildingPanel.appendChild(buildingTypesTable);
    
    // 4. 时间Tab面板
    const timePanel = tabPanels['时间'];
    
    // 创建时间比较表格
    const timeTable = document.createElement('table');
    timeTable.style.width = '100%';
    timeTable.style.borderCollapse = 'collapse';
    timeTable.style.marginBottom = '20px';
    
    // 创建表头
    const timeHeader = document.createElement('thead');
    const timeHeaderRow = document.createElement('tr');
    timeHeaderRow.style.backgroundColor = '#f0f0f0';
    
    const timeHeaders = ['玩家', '总用时', '平均每回合用时', '最长回合用时', '最短回合用时'];
    
    timeHeaders.forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        header.style.padding = '8px';
        header.style.textAlign = headerText === '玩家' ? 'left' : 'center';
        header.style.borderBottom = '2px solid #ddd';
        timeHeaderRow.appendChild(header);
    });
    
    timeHeader.appendChild(timeHeaderRow);
    timeTable.appendChild(timeHeader);
    
    const timeBody = document.createElement('tbody');
    
    // 排序玩家（按总用时）
    const playersByTime = [...gameState.players]
        .filter(player => !player.isDefeated)
        .sort((a, b) => a.totalTurnTime - b.totalTurnTime);
    
    playersByTime.forEach((player, index) => {
        const row = document.createElement('tr');
        row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
        
        // 玩家名
        const playerCell = document.createElement('td');
        playerCell.textContent = player.name;
        playerCell.style.fontWeight = 'bold';
        playerCell.style.color = player.color.main;
        playerCell.style.padding = '8px';
        
        // 总用时
        const totalTimeSec = Math.floor(player.totalTurnTime / 1000);
        const timeHrs = Math.floor(totalTimeSec / 3600);
        const timeMins = Math.floor((totalTimeSec % 3600) / 60);
        const timeSecs = totalTimeSec % 60;
        const playerTimeStr = 
            (timeHrs > 0 ? `${timeHrs}小时` : '') + 
            (timeMins > 0 ? `${timeMins}分` : '') + 
            `${timeSecs}秒`;
        
        const totalTimeCell = document.createElement('td');
        totalTimeCell.textContent = playerTimeStr;
        totalTimeCell.style.textAlign = 'center';
        totalTimeCell.style.padding = '8px';
        
        // 平均每回合用时
        const avgTurnTime = player.turnCount > 0 ? 
            Math.floor(player.totalTurnTime / player.turnCount / 1000) : 0;
        const avgMins = Math.floor(avgTurnTime / 60);
        const avgSecs = avgTurnTime % 60;
        
        const avgTimeCell = document.createElement('td');
        avgTimeCell.textContent = `${avgMins}分${avgSecs}秒`;
        avgTimeCell.style.textAlign = 'center';
        avgTimeCell.style.padding = '8px';
        
        // 最长回合用时
        const maxTurnTime = player.maxTurnTime || 0;
        const maxMins = Math.floor(maxTurnTime / 60000);
        const maxSecs = Math.floor((maxTurnTime % 60000) / 1000);
        
        const maxTimeCell = document.createElement('td');
        maxTimeCell.textContent = `${maxMins}分${maxSecs}秒`;
        maxTimeCell.style.textAlign = 'center';
        maxTimeCell.style.padding = '8px';
        
        // 最短回合用时
        const minTurnTime = player.minTurnTime || 0;
        const minMins = Math.floor(minTurnTime / 60000);
        const minSecs = Math.floor((minTurnTime % 60000) / 1000);
        
        const minTimeCell = document.createElement('td');
        minTimeCell.textContent = `${minMins}分${minSecs}秒`;
        minTimeCell.style.textAlign = 'center';
        minTimeCell.style.padding = '8px';
        
        row.appendChild(playerCell);
        row.appendChild(totalTimeCell);
        row.appendChild(avgTimeCell);
        row.appendChild(maxTimeCell);
        row.appendChild(minTimeCell);
        
        timeBody.appendChild(row);
    });
    
    timeTable.appendChild(timeBody);
    timePanel.appendChild(timeTable);
    
    // 将所有面板添加到统计容器
    statsContainer.appendChild(tabsContainer);
    for (const panel of Object.values(tabPanels)) {
        statsContainer.appendChild(panel);
    }
    
    // 添加新游戏按钮
    const newGameBtn = document.createElement('button');
    newGameBtn.textContent = '开始新游戏';
    newGameBtn.style.padding = '10px 20px';
    newGameBtn.style.backgroundColor = '#4CAF50';
    newGameBtn.style.color = 'white';
    newGameBtn.style.border = 'none';
    newGameBtn.style.borderRadius = '4px';
    newGameBtn.style.cursor = 'pointer';
    newGameBtn.style.fontSize = '16px';
    newGameBtn.style.marginTop = '20px';
    
    newGameBtn.addEventListener('click', () => {
        document.body.removeChild(victoryOverlay);
        showPlayerCountDialog();
    });
    
    // 组装弹窗
    contentContainer.appendChild(detailedStatsTitle);
    contentContainer.appendChild(statsContainer);
    
    victoryBox.appendChild(victoryTitle);
    victoryBox.appendChild(victoryDesc);
    victoryBox.appendChild(gameTimeInfo);
    victoryBox.appendChild(contentContainer);
    victoryBox.appendChild(newGameBtn);
    victoryOverlay.appendChild(victoryBox);
    
    // 添加到页面
    document.body.appendChild(victoryOverlay);
}

// 处理教官战术指导能力
function processInstructorGuidance() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 首先清除所有单位的战术指导加成状态
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === currentPlayer.id) {
            tile.unit.tacticalGuidanceBoost = false;
        }
    }
    
    // 查找所有当前玩家的教官单位
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === currentPlayer.id && tile.unit.type === 'instructor') {
            // 找到教官，为附近的所有友方单位提供加成
            const x = tile.x;
            const y = tile.y;
            
            // 寻找相邻的友方单位
            let boostedUnits = 0;
            
            // 检查4个相邻格子
            const adjacentCoords = [
                {x: x, y: y-1}, // 上
                {x: x+1, y: y}, // 右
                {x: x, y: y+1}, // 下
                {x: x-1, y: y}  // 左
            ];
            
            for (const coord of adjacentCoords) {
                if (coord.x >= 0 && coord.x < GRID_WIDTH && coord.y >= 0 && coord.y < GRID_HEIGHT) {
                    const adjTileIndex = coord.y * GRID_WIDTH + coord.x;
                    const adjTile = gameState.map[adjTileIndex];
                    
                    if (adjTile.unit && adjTile.unit.ownerId === currentPlayer.id && adjTile.unit.type !== 'instructor') {
                        // 找到适合加成的单位
                        adjTile.unit.tacticalGuidanceBoost = true;
                        boostedUnits++;
                        
                        // 计算加成前和加成后的攻击力
                        const baseAttack = UNITS[adjTile.unit.type].attack;
                        const boostedAttack = Math.floor(baseAttack * 1.15);
                    }
                }
            }
            
            // 添加游戏日志
            if (boostedUnits > 0) {
                addLogEntry(`⭐ ${currentPlayer.name}的教官对${boostedUnits}个相邻友方单位进行了战术指导，提升了15%的攻击力。`);
                showNotification(`教官提供了战术指导加成！`, 'success');
            }
        }
    }
}

// 处理油车领地占领能力
function processOilCarAbility() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let territoryChanged = false;
    
    // 遍历地图上的所有格子
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        
        // 检查是否有油车单位在敌方领地上
        if (tile.unit && 
            tile.unit.type === 'oilCar' && 
            tile.unit.ownerId === currentPlayer.id &&
            tile.ownerId !== null && 
            tile.ownerId !== currentPlayer.id) {
            
            // 初始化倒计时属性（如果没有的话）
            if (tile.unit.territoryClaimTimer === undefined) {
                tile.unit.territoryClaimTimer = UNITS.oilCar.claimCountdown;
                
                // 添加日志
                const tilePlayer = gameState.players[tile.ownerId];
                addLogEntry(`${currentPlayer.name}的油车进入了${tilePlayer.name}的领地，将在${tile.unit.territoryClaimTimer}回合后占领此地。`);
            } else {
                // 倒计时递减
                tile.unit.territoryClaimTimer--;
                
                // 检查是否可以占领领地
                if (tile.unit.territoryClaimTimer <= 0) {
                    // 保存原有所有者的ID
                    const originalOwnerId = tile.ownerId;
                    const originalPlayer = gameState.players[originalOwnerId];
                    
                    // 改变领地所有权
                    tile.ownerId = currentPlayer.id;
                    
                    // 移除敌方建筑（如果有的话）
                    if (tile.building) {
                        tile.building = null;
                    }
                    
                    // 生成随机建筑
                    generateRandomBuildingForOilCar(tile);
                    
                    // 添加日志
                    addLogEntry(`${currentPlayer.name}的油车成功占领了${originalPlayer.name}的领地(${tile.x}, ${tile.y})。`);
                    
                    // 不再消耗油车，保留油车单位
                    // 重置油车的占领计时器，以便它可以继续占领其他领地
                    tile.unit.territoryClaimTimer = undefined;
                    
                    territoryChanged = true;
                } else {
                    // 还在倒计时中，添加日志
                    addLogEntry(`${currentPlayer.name}的油车还需${tile.unit.territoryClaimTimer}回合占领此地。`);
                }
            }
        }
    }
    
    // 如果领地发生变化，更新UI
    if (territoryChanged) {
        updateGameStateDisplay();
        drawMap();
    }
}

// 为油车占领的领地生成随机建筑
function generateRandomBuildingForOilCar(tile) {
    // 根据概率生成不同的建筑
    const randomValue = Math.random();
    let buildingType = null;
    
    if (randomValue < 0.6) {
        // 60% 概率生成油井
        buildingType = 'oilWell';
    } else if (randomValue < 0.8) {
        // 20% 概率生成贸易站
        buildingType = 'tradingPost';
    } else if (randomValue < 0.9) {
        // 10% 概率不生成任何建筑
        return;
    } else if (randomValue < 0.99) {
        // 9% 概率生成银行
        buildingType = 'bank';
    } else {
        // 1% 概率生成魔法学院
        buildingType = 'magicAcademy';
    }
    
    if (buildingType) {
        // 生成建筑
        tile.building = {
            type: buildingType,
            name: BUILDINGS[buildingType].name,
            health: BUILDINGS[buildingType].maxHealth,
            x: tile.x,
            y: tile.y
        };
        
        // 添加日志
        const player = gameState.players[tile.ownerId];
        addLogEntry(`${player.name}在被油车占领的领地(${tile.x}, ${tile.y})上获得了一座${BUILDINGS[buildingType].name}！`);
        
        // 更新玩家收入
        updatePlayerIncome(player);
    }
}

// 处理魔法兵复活能力
function processMagicSoldierAbility() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let soldierResurrected = false;
    
    // 检查是否有魔法学院
    let hasMagicAcademy = false;
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.ownerId === currentPlayer.id && 
            tile.building && 
            tile.building.type === 'magicAcademy') {
            hasMagicAcademy = true;
            break;
        }
    }
    
    // 如果没有魔法学院，直接返回
    if (!hasMagicAcademy) return;
    
    // 遍历地图上所有的单位
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        
        // 检查是否是当前玩家的受伤单位
        if (tile.unit && 
            tile.unit.ownerId === currentPlayer.id && 
            tile.unit.health < (tile.unit.maxHealth || UNITS[tile.unit.type].health) * 0.1) {
            
            if (tile.unit.hasResurrected) continue;
            
            tile.unit.health = tile.unit.maxHealth || UNITS[tile.unit.type].health;
            tile.unit.hasResurrected = true; // 标记已使用复活能力
            
            // 添加日志
            addLogEntry(`${currentPlayer.name}的${UNITS[tile.unit.type].name}在魔法学院的加持下复活了！`);
            
            soldierResurrected = true;
            break; // 每回合只复活一个单位
        }
    }
    
    // 如果有单位复活，更新UI
    if (soldierResurrected) {
        updateGameStateDisplay();
        drawMap();
    }
}

// 处理魔法兵的特殊效果
function processMagicSoldierEffect() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let effectsApplied = false;
    
    // 遍历地图上所有的单位
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        
        // 检查是否是当前玩家的魔法兵
        if (tile.unit && 
            tile.unit.ownerId === currentPlayer.id && 
            tile.unit.type === 'magicSoldier') {
            
            const unit = tile.unit;
            const maxHealth = UNITS.magicSoldier.health;
            const healthPercentage = unit.health / maxHealth;
            
            // 处理血量低于50%的效果：每回合扣除10%血量并增加100%攻击力
            if (healthPercentage < 0.5) {
                // 减少10%的血量
                const healthReduction = Math.ceil(maxHealth * 0.1);
                unit.health = Math.max(1, unit.health - healthReduction);
                
                // 增加100%攻击力
                if (!unit.attackBoosted) {
                    unit.baseAttack = unit.attack; // 保存原始攻击力
                    unit.attack = unit.attack * 2;
                    unit.attackBoosted = true;
                }
                
                // 添加日志
                addLogEntry(`${currentPlayer.name}的魔法兵血量降至${unit.health}，攻击力提升至${unit.attack}！`);
                effectsApplied = true;
            }
        }
    }
    
    // 如果有效果被应用，更新UI
    if (effectsApplied) {
        updateGameStateDisplay();
        drawMap();
    }
}

// 计算城市的实际价格（每多一个城市价格翻倍）
function getCityCost(player) {
    const existingCities = player.buildings.filter(b => b.type === 'city').length;
    return BUILDINGS.city.cost * Math.pow(2, existingCities);
}

// 获取玩家首都位置
function getCapitalPosition(player) {
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.ownerId === player.id && tile.building && tile.building.type === 'capital') {
            return { x: tile.x, y: tile.y };
        }
    }
    return null;
}

// 获取玩家所有城市锚点位置
function getCityPositions(player) {
    const positions = [];
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.ownerId === player.id && tile.building && tile.building.type === 'city' && tile.building.isCityAnchor) {
            positions.push({ x: tile.x, y: tile.y });
        }
    }
    return positions;
}

// 验证城市建造位置是否合法
function validateCityPlacement(x, y, player) {
    // 检查2x2区域是否在地图范围内
    if (x + 1 >= GRID_WIDTH || y + 1 >= GRID_HEIGHT) {
        return { valid: false, reason: '城市需要2x2的空间，超出地图边界！' };
    }
    
    // 检查2x2区域内所有格子
    const tiles = [
        { tx: x, ty: y }, { tx: x + 1, ty: y },
        { tx: x, ty: y + 1 }, { tx: x + 1, ty: y + 1 }
    ];
    
    for (const { tx, ty } of tiles) {
        const tileIndex = ty * GRID_WIDTH + tx;
        const tile = gameState.map[tileIndex];
        
        if (tile.ownerId !== player.id) {
            return { valid: false, reason: '城市的所有4个格子必须在自己领土内！' };
        }
        if (tile.building) {
            return { valid: false, reason: '城市区域内不能有其他建筑！' };
        }
        if (tile.unit) {
            return { valid: false, reason: '城市区域内不能有军事单位！' };
        }
        if (tile.terrain === 'water') {
            return { valid: false, reason: '不能在水域上建造城市！' };
        }
        
        const existingProgress = gameState.buildingQueue.find(bp => bp.x === tx && bp.y === ty);
        if (existingProgress) {
            return { valid: false, reason: '城市区域内有正在建造的建筑！' };
        }
    }
    
    // 检查距离首都至少8格
    const capitalPos = getCapitalPosition(player);
    if (capitalPos) {
        const dist = manhattanDistance(x, y, capitalPos.x, capitalPos.y);
        if (dist < BUILDINGS.city.minDistanceFromCapital) {
            return { valid: false, reason: `城市必须距离首都至少${BUILDINGS.city.minDistanceFromCapital}格！(当前${dist}格)` };
        }
    }
    
    // 检查与其他城市的间距至少5格
    const cityPositions = getCityPositions(player);
    for (const pos of cityPositions) {
        const dist = manhattanDistance(x, y, pos.x, pos.y);
        if (dist < BUILDINGS.city.minDistanceBetweenCities) {
            return { valid: false, reason: `城市之间必须间隔至少${BUILDINGS.city.minDistanceBetweenCities}格！(与现有城市距离${dist}格)` };
        }
    }
    
    return { valid: true };
}

// 建造城市（2x2）
function startCityBuilding(x, y) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const cityCost = getCityCost(currentPlayer);
    
    // 验证位置
    const validation = validateCityPlacement(x, y, currentPlayer);
    if (!validation.valid) {
        showNotification(validation.reason, 'error');
        return false;
    }
    
    // 检查金币
    if (currentPlayer.gold < cityCost) {
        showNotification(`金币不足！城市需要${cityCost}金币。`, 'error');
        return false;
    }
    
    // 扣除金币
    currentPlayer.gold -= cityCost;
    
    let buildTime = BUILDINGS.city.buildTime;
    if (currentPlayer.enchantments && currentPlayer.enchantments.includes('fastBuild')) {
        buildTime = Math.max(1, buildTime - 1);
    }
    
    // 创建建筑进度（只记录锚点，但标记2x2）
    const buildingProgress = {
        x: x,
        y: y,
        type: 'city',
        progress: 0,
        totalTime: buildTime,
        ownerId: currentPlayer.id,
        isCity: true,
        cityTiles: [
            { x: x, y: y }, { x: x + 1, y: y },
            { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }
        ]
    };
    
    gameState.buildingQueue.push(buildingProgress);
    
    addLogEntry(`${currentPlayer.name}开始在坐标(${x}, ${y})建造城市，花费${cityCost}金币。`);
    showNotification(`开始建造城市，将在${buildTime}回合后完成。`, 'success');
    
    return true;
}

// 完成城市建造（放置2x2建筑到地图上）
function buildCity(x, y, ownerId) {
    const buildingId = generateBuildingId();
    const player = gameState.players[ownerId];
    
    // 创建城市锚点建筑
    const cityBuilding = {
        type: 'city',
        name: '城市',
        health: BUILDINGS.city.maxHealth,
        id: buildingId,
        isCityAnchor: true,
        anchorX: x,
        anchorY: y
    };
    
    // 放置到4个格子
    const tiles = [
        { tx: x, ty: y }, { tx: x + 1, ty: y },
        { tx: x, ty: y + 1 }, { tx: x + 1, ty: y + 1 }
    ];
    
    for (let i = 0; i < tiles.length; i++) {
        const { tx, ty } = tiles[i];
        const tileIndex = ty * GRID_WIDTH + tx;
        const tile = gameState.map[tileIndex];
        
        if (i === 0) {
            tile.building = cityBuilding;
        } else {
            tile.building = {
                type: 'city',
                name: '城市',
                health: BUILDINGS.city.maxHealth,
                id: buildingId,
                isCityPart: true,
                cityAnchorX: x,
                cityAnchorY: y
            };
        }
        
        tile.ownerId = ownerId;
    }
    
    // 扩张领土（从4个角扩展）
    for (const { tx, ty } of tiles) {
        expandTerritory(tx, ty, ownerId);
    }
    
    syncPlayerBuildings(ownerId);
    updatePlayerIncome(player);
    
    addLogEntry(`${player.name}在坐标(${x}, ${y})建造了城市！所有军事单位现在每回合可以同时移动和攻击。`);
    showNotification('城市建造完成！单位现在可以每回合移动+攻击！', 'success');
}

// 检查玩家是否拥有城市
function playerHasCity(player) {
    return player.buildings.some(b => b.type === 'city' && b.isCityAnchor);
}

// 将首都迁至指定城市锚点（需至少拥有一座城市；原首都格清空，该城2×2清空并在锚点放置新首都）
function relocateCapitalToCity(cityAnchorX, cityAnchorY) {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player || player.isDefeated) return false;

    const capPos = getCapitalPosition(player);
    if (!capPos) {
        showNotification('未找到首都！', 'error');
        return false;
    }
    if (capPos.x === cityAnchorX && capPos.y === cityAnchorY) {
        showNotification('首都已经在这座城！', 'error');
        return false;
    }

    const cityPositions = getCityPositions(player);
    if (cityPositions.length === 0) {
        showNotification('迁都需要至少一座已建成城市！', 'error');
        return false;
    }

    const isTargetCity = cityPositions.some(p => p.x === cityAnchorX && p.y === cityAnchorY);
    if (!isTargetCity) {
        showNotification('目标必须是己方城市的锚点格（2×2 的左上格）。', 'error');
        return false;
    }

    const ax = cityAnchorX;
    const ay = cityAnchorY;
    const cityTiles = [
        { tx: ax, ty: ay },
        { tx: ax + 1, ty: ay },
        { tx: ax, ty: ay + 1 },
        { tx: ax + 1, ty: ay + 1 }
    ];

    for (const { tx, ty } of cityTiles) {
        const idx = ty * GRID_WIDTH + tx;
        const t = gameState.map[idx];
        if (!t || t.ownerId !== player.id) {
            showNotification('目标城市区域必须完全在你的领土内！', 'error');
            return false;
        }
        if (t.unit) {
            showNotification('迁都目标城市的 2×2 范围内不能有军事单位！', 'error');
            return false;
        }
    }

    for (const bp of gameState.buildingQueue) {
        for (const { tx, ty } of cityTiles) {
            if (bp.x === tx && bp.y === ty) {
                showNotification('目标区域有建筑正在建造中，无法迁都。', 'error');
                return false;
            }
            if (bp.isCity && bp.cityTiles && bp.cityTiles.some(ct => ct.x === tx && ct.y === ty)) {
                showNotification('目标区域有建筑正在建造中，无法迁都。', 'error');
                return false;
            }
        }
    }

    const anchorIdx = ay * GRID_WIDTH + ax;
    const anchorTile = gameState.map[anchorIdx];
    const cityB = anchorTile.building;
    if (!cityB || cityB.type !== 'city' || !cityB.isCityAnchor) {
        showNotification('目标格不是城市锚点！', 'error');
        return false;
    }

    const oldIdx = capPos.y * GRID_WIDTH + capPos.x;
    const oldTile = gameState.map[oldIdx];
    const oldCap = oldTile.building;
    if (!oldCap || oldCap.type !== 'capital') {
        showNotification('原首都不存在！', 'error');
        return false;
    }

    ensureFiniteBuildingHealthBeforeDamage(oldCap);
    const capMax = BUILDINGS.capital.maxHealth;
    const transferredHp = Math.min(capMax, Math.max(1, Math.round(oldCap.health)));

    oldTile.building = null;

    for (const { tx, ty } of cityTiles) {
        const idx = ty * GRID_WIDTH + tx;
        gameState.map[idx].building = null;
    }

    const newCapital = {
        type: 'capital',
        name: BUILDINGS.capital.name,
        income: BUILDINGS.capital.income,
        health: transferredHp,
        id: generateBuildingId()
    };
    gameState.map[anchorIdx].building = newCapital;

    syncPlayerBuildings(player.id);
    updatePlayerIncome(player);

    addLogEntry(
        `${player.name}将首都迁至(${ax},${ay})，原首都(${capPos.x},${capPos.y})已腾空；该处城市已升格为新首都。`
    );
    showNotification('迁都完成！新首都继承原首都当前生命值；原城市 2×2 已清空。', 'success');

    updateGameStateDisplay();
    drawMap();
    return true;
}

// 购买词条
function purchaseEnchantment(enchantmentId) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const enchantment = ENCHANTMENTS[enchantmentId];
    
    if (!enchantment) {
        showNotification('无效的词条！', 'error');
        return false;
    }
    
    // 检查是否已拥有
    if (currentPlayer.enchantments.includes(enchantmentId)) {
        showNotification('已拥有该词条！', 'error');
        return false;
    }
    
    // 检查金币
    if (currentPlayer.gold < enchantment.cost) {
        showNotification('金币不足！', 'error');
        return false;
    }
    
    // 扣除金币
    currentPlayer.gold -= enchantment.cost;
    
    // 添加词条
    currentPlayer.enchantments.push(enchantmentId);
    
    addLogEntry(`${currentPlayer.name}获得了词条「${enchantment.name}」：${enchantment.desc}`);
    showNotification(`成功获得词条「${enchantment.name}」！`, 'success');
    
    // 如果是经济类词条，立即更新收入
    if (enchantmentId === 'economicBoom' || enchantmentId === 'goldRush') {
        updatePlayerIncome(currentPlayer);
    }
    
    updateGameStateDisplay();
    drawMap();
    return true;
}

// 处理词条效果：生命恢复
function processEnchantmentRegeneration() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.enchantments || !currentPlayer.enchantments.includes('regeneration')) return;
    
    let healed = false;
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === currentPlayer.id) {
            const maxHealth = tile.unit.maxHealth || UNITS[tile.unit.type].health;
            if (tile.unit.health < maxHealth) {
                tile.unit.health = Math.min(tile.unit.health + 15, maxHealth);
                healed = true;
            }
        }
    }
    
    if (healed) {
        addLogEntry(`${currentPlayer.name}的词条「生命恢复」为受伤单位恢复了生命值。`);
    }
}

// 拆除建筑
function demolishBuilding(x, y) {
    const tileIndex = y * GRID_WIDTH + x;
    const tile = gameState.map[tileIndex];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    const buildingOwner = getTileBuildingOwnerId(tile);
    if (buildingOwner !== currentPlayer.id || !tile.building) {
        showNotification('只能拆除自己的建筑！', 'error');
        return false;
    }
    
    const building = tile.building;
    let buildingType = building.type;
    
    // 首都不能拆除
    if (buildingType === 'capital') {
        showNotification('不能拆除首都！', 'error');
        return false;
    }
    
    // 处理城市（2x2）拆除
    if (buildingType === 'city') {
        let anchorX, anchorY;
        if (building.isCityAnchor) {
            anchorX = building.anchorX;
            anchorY = building.anchorY;
        } else if (building.isCityPart) {
            anchorX = building.cityAnchorX;
            anchorY = building.cityAnchorY;
        }
        
        // 计算返还（用实际支付的价格计算比较复杂，简化为基础价格50%）
        const existingCities = currentPlayer.buildings.filter(b => b.type === 'city' && b.isCityAnchor).length;
        const cityCost = BUILDINGS.city.cost * Math.pow(2, Math.max(0, existingCities - 1));
        const refund = Math.floor(cityCost * 0.5);
        
        currentPlayer.gold += refund;
        
        // 清除4个格子
        const cityTiles = [
            { tx: anchorX, ty: anchorY }, { tx: anchorX + 1, ty: anchorY },
            { tx: anchorX, ty: anchorY + 1 }, { tx: anchorX + 1, ty: anchorY + 1 }
        ];
        
        for (const { tx, ty } of cityTiles) {
            if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
                const idx = ty * GRID_WIDTH + tx;
                gameState.map[idx].building = null;
            }
        }
        
        syncPlayerBuildings(currentPlayer.id);
        updatePlayerIncome(currentPlayer);
        
        addLogEntry(`${currentPlayer.name}拆除了城市，返还${refund}金币。`);
        showNotification(`拆除城市，返还${refund}金币！`, 'success');
        
        updateGameStateDisplay();
        drawMap();
        return true;
    }
    
    // 普通建筑拆除
    const originalCost = BUILDINGS[buildingType].cost;
    const refund = Math.floor(originalCost * 0.5);
    
    currentPlayer.gold += refund;
    
    const buildingName = building.name;
    const expanderClaimed =
        buildingType === 'territoryExpander' ? building.expanderClaimedCells : null;
    tile.building = null;
    if (buildingType === 'territoryExpander') {
        revertTerritoryExpanderClaims(x, y, expanderClaimed, currentPlayer.id);
    }
    
    syncPlayerBuildings(currentPlayer.id);
    updatePlayerIncome(currentPlayer);
    
    addLogEntry(`${currentPlayer.name}拆除了${buildingName}，返还${refund}金币。`);
    showNotification(`拆除${buildingName}，返还${refund}金币！`, 'success');
    
    updateGameStateDisplay();
    drawMap();
    return true;
}

// 检查玩家是否拥有魔法学院
function playerHasMagicAcademy(player) {
    return player.buildings.some(b => b.type === 'magicAcademy');
}

// 处理导弹工厂生产进度
function processMissileProduction() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.ownerId === currentPlayer.id && tile.building && tile.building.type === 'missileFactory') {
            const factory = tile.building;
            
            if (!factory.storedMissiles) factory.storedMissiles = 0;
            
            if (factory.missileBuilding) {
                factory.missileBuildTurns--;
                
                if (factory.missileBuildTurns <= 0) {
                    factory.storedMissiles++;
                    factory.missileBuilding = false;
                    factory.missileBuildTurns = 0;
                    addLogEntry(`${currentPlayer.name}的导弹工厂(${tile.x},${tile.y})完成了一枚导弹的建造！当前存储: ${factory.storedMissiles}枚`);
                    showNotification(`导弹建造完成！工厂存储: ${factory.storedMissiles}枚`, 'success');
                }
            }
        }
    }
}

// 处理海盗船刷新海盗
function processPirateSpawn() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let spawned = false;
    
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.building && tile.building.type === 'pirateShip' &&
            tile.building.placedByPlayerId === currentPlayer.id) {
            const ship = tile.building;
            if (ship.pirateSpawnTimer === undefined) ship.pirateSpawnTimer = 0;
            
            ship.pirateSpawnTimer++;
            
            if (ship.pirateSpawnTimer >= BUILDINGS.pirateShip.pirateSpawnInterval) {
                ship.pirateSpawnTimer = 0;
                
                // 在船附近的空陆地格生成海盗
                const spawnTile = findPirateSpawnTile(tile.x, tile.y);
                if (spawnTile) {
                    const pirateUnit = {
                        type: 'pirate',
                        health: UNITS.pirate.health,
                        ownerId: -1,
                        hasActed: false,
                        hasMoved: false,
                        hasAttacked: false,
                        x: spawnTile.x,
                        y: spawnTile.y,
                        id: 'pirate_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
                    };
                    spawnTile.unit = pirateUnit;
                    spawned = true;
                    addLogEntry(`${currentPlayer.name}的海盗船(${tile.x},${tile.y})刷新了一个海盗！`);
                }
            }
        }
    }
    
    if (spawned) {
        updateGameStateDisplay();
        drawMap();
    }
}

// 为海盗刷新寻找附近的空地格
function findPirateSpawnTile(shipX, shipY) {
    for (let r = 1; r <= 3; r++) {
        const candidates = [];
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > r) continue;
                const nx = shipX + dx;
                const ny = shipY + dy;
                if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
                const idx = ny * GRID_WIDTH + nx;
                const tile = gameState.map[idx];
                if (!tile.unit && !tile.building && tile.terrain !== 'water') {
                    candidates.push(tile);
                }
            }
        }
        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
    }
    return null;
}

// BFS寻路：找到从起点到目标的最短路径（避开水域和障碍）
function findPathBFS(startX, startY, targetX, targetY) {
    const key = (x, y) => x + ',' + y;
    const visited = new Set();
    const queue = [{ x: startX, y: startY, path: [] }];
    visited.add(key(startX, startY));
    
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        if (current.x === targetX && current.y === targetY) {
            return current.path;
        }
        
        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            
            if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
            if (visited.has(key(nx, ny))) continue;
            
            const idx = ny * GRID_WIDTH + nx;
            const tile = gameState.map[idx];
            
            if (tile.terrain === 'water') continue;
            
            visited.add(key(nx, ny));
            queue.push({ x: nx, y: ny, path: [...current.path, { x: nx, y: ny }] });
        }
    }
    
    return null;
}

// 找到离海盗最近的首都位置
function findNearestCapital(pirateX, pirateY) {
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const player of gameState.players) {
        if (player.defeated) continue;
        const capitalPos = getCapitalPosition(player);
        if (!capitalPos) continue;
        
        const dist = manhattanDistance(pirateX, pirateY, capitalPos.x, capitalPos.y);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = capitalPos;
        }
    }
    
    return nearest;
}

// 海盗攻击目标单位
function pirateAttackUnit(pirateTile, targetTile) {
    const target = targetTile.unit;
    const targetPlayer = gameState.players[target.ownerId];
    const targetUnitDef = UNITS[target.type];
    const targetName = targetUnitDef ? targetUnitDef.name : '未知单位';
    
    const damage = Math.max(1, UNITS.pirate.attack - (targetUnitDef ? targetUnitDef.defense : 0));
    target.health -= damage;
    
    if (target.health <= 0) {
        addLogEntry(`海盗攻击并击杀了${targetPlayer.name}的${targetName}！`);
        const unitIndex = targetPlayer.units.findIndex(u => u.id === target.id);
        if (unitIndex !== -1) targetPlayer.units.splice(unitIndex, 1);
        targetTile.unit = null;
    } else {
        addLogEntry(`海盗攻击了${targetPlayer.name}的${targetName}，造成${damage}点伤害。`);
    }
}

// 海盗攻击目标建筑
function pirateAttackBuilding(pirateTile, targetTile) {
    const building = targetTile.building;
    if (!building) return;
    const buildingType = building.type;
    
    // 海盗不攻击海盗船
    if (buildingType === 'pirateShip') return;
    
    const buildingDef = BUILDINGS[buildingType];
    const buildingName = buildingType === 'capital' ? '首都' : (buildingDef ? buildingDef.name : '未知建筑');
    const bOwnerId = getTileBuildingOwnerId(targetTile);
    const targetPlayer = bOwnerId != null ? gameState.players[bOwnerId] : null;
    if (!targetPlayer) return;
    
    let damage = UNITS.pirate.attack;
    // 建筑享有25%伤害减免
    damage = Math.floor(damage * 0.75);
    damage = Math.max(1, damage);
    
    ensureFiniteBuildingHealthBeforeDamage(building);
    building.health = Math.max(0, building.health - damage);
    
    if (building.health <= 0) {
        if (buildingType === 'capital') {
            targetTile.building = null;
            addLogEntry(`海盗摧毁了${targetPlayer.name}的首都！`);
            destroyAllPlayerAssets(bOwnerId);
            checkGameOver();
        } else {
            addLogEntry(`海盗摧毁了${targetPlayer.name}的${buildingName}！`);
            const bx = targetTile.x;
            const by = targetTile.y;
            const bSnap = building;
            targetTile.building = null;
            if (buildingType === 'territoryExpander') {
                revertTerritoryExpanderClaims(bx, by, bSnap.expanderClaimedCells, bOwnerId);
            }
        }
        syncPlayerBuildings(bOwnerId);
        updatePlayerIncome(targetPlayer);
    } else {
        addLogEntry(`海盗攻击了${targetPlayer.name}的${buildingName}，造成${damage}点伤害。`);
    }
}

// 处理海盗移动和攻击（在每个玩家回合末执行）
function processPirateAttack() {
    let actionHappened = false;
    
    const pirateTiles = [];
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === -1 && tile.unit.type === 'pirate') {
            pirateTiles.push(tile);
        }
    }
    
    for (const pirateTile of pirateTiles) {
        const pirate = pirateTile.unit;
        if (!pirate) continue;
        
        const moveRange = UNITS.pirate.moveRange;
        const attackRange = UNITS.pirate.attackRange;
        
        // 先检查攻击范围内是否有可攻击的目标（单位或建筑）
        let attacked = false;
        let nearestTarget = null;
        let nearestDist = Infinity;
        
        for (let j = 0; j < gameState.map.length; j++) {
            const targetTile = gameState.map[j];
            const dist = Math.abs(pirateTile.x - targetTile.x) + Math.abs(pirateTile.y - targetTile.y);
            if (dist > attackRange || dist === 0) continue;
            
            // 攻击任何玩家的单位（包括经济单位）
            if (targetTile.unit && targetTile.unit.ownerId !== -1) {
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestTarget = { tile: targetTile, type: 'unit' };
                }
            }
            // 攻击任何玩家的建筑（但不攻击海盗船；归属用 getTileBuildingOwnerId）
            if (targetTile.building && targetTile.building.type !== 'pirateShip') {
                const bo = getTileBuildingOwnerId(targetTile);
                if (bo != null && bo >= 0 && dist < nearestDist) {
                    nearestDist = dist;
                    nearestTarget = { tile: targetTile, type: 'building' };
                }
            }
        }
        
        if (nearestTarget) {
            actionHappened = true;
            attacked = true;
            if (nearestTarget.type === 'unit') {
                pirateAttackUnit(pirateTile, nearestTarget.tile);
            } else {
                pirateAttackBuilding(pirateTile, nearestTarget.tile);
            }
        }
        
        // 如果没有攻击，则向最近的首都移动
        if (!attacked) {
            const capitalPos = findNearestCapital(pirateTile.x, pirateTile.y);
            if (!capitalPos) continue;
            
            const path = findPathBFS(pirateTile.x, pirateTile.y, capitalPos.x, capitalPos.y);
            if (!path || path.length === 0) continue;
            
            // 沿路径移动，最多移动 moveRange 步
            let stepsToMove = Math.min(moveRange, path.length);
            let finalStep = null;
            
            for (let s = 0; s < stepsToMove; s++) {
                const step = path[s];
                const stepIdx = step.y * GRID_WIDTH + step.x;
                const stepTile = gameState.map[stepIdx];
                
                // 路上遇到敌方单位 -> 停下并攻击
                if (stepTile.unit && stepTile.unit.ownerId !== -1) {
                    actionHappened = true;
                    pirateAttackUnit(pirateTile, stepTile);
                    // 移动到攻击目标前一格
                    if (finalStep) {
                        const finalIdx = finalStep.y * GRID_WIDTH + finalStep.x;
                        const finalTile = gameState.map[finalIdx];
                        pirate.x = finalStep.x;
                        pirate.y = finalStep.y;
                        finalTile.unit = pirate;
                        pirateTile.unit = null;
                        actionHappened = true;
                    }
                    break;
                }
                
                // 路上遇到敌方建筑 -> 停在建筑旁攻击（但不攻击海盗船）
                const stepBuildingOwner = getTileBuildingOwnerId(stepTile);
                if (stepTile.building && stepTile.building.type !== 'pirateShip' &&
                    stepBuildingOwner != null && stepBuildingOwner >= 0) {
                    actionHappened = true;
                    pirateAttackBuilding(pirateTile, stepTile);
                    if (finalStep) {
                        const finalIdx = finalStep.y * GRID_WIDTH + finalStep.x;
                        const finalTile = gameState.map[finalIdx];
                        pirate.x = finalStep.x;
                        pirate.y = finalStep.y;
                        finalTile.unit = pirate;
                        pirateTile.unit = null;
                    }
                    break;
                }
                
                // 该格可以通行
                if (!stepTile.unit && !stepTile.building) {
                    finalStep = step;
                } else {
                    break;
                }
                
                // 已到达最后可移动步数，执行移动
                if (s === stepsToMove - 1 && finalStep) {
                    const finalIdx = finalStep.y * GRID_WIDTH + finalStep.x;
                    const finalTile = gameState.map[finalIdx];
                    pirate.x = finalStep.x;
                    pirate.y = finalStep.y;
                    finalTile.unit = pirate;
                    pirateTile.unit = null;
                    actionHappened = true;
                    
                    // 移动后再检查攻击范围内是否有目标
                    for (let j = 0; j < gameState.map.length; j++) {
                        const targetTile = gameState.map[j];
                        const dist = Math.abs(finalStep.x - targetTile.x) + Math.abs(finalStep.y - targetTile.y);
                        if (dist > attackRange || dist === 0) continue;
                        
                        if (targetTile.unit && targetTile.unit.ownerId !== -1) {
                            pirateAttackUnit(finalTile, targetTile);
                            break;
                        }
                        if (targetTile.building && targetTile.building.type !== 'pirateShip') {
                            const bo = getTileBuildingOwnerId(targetTile);
                            if (bo != null && bo >= 0) {
                                pirateAttackBuilding(finalTile, targetTile);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    if (actionHappened) {
        updateGameStateDisplay();
        drawMap();
    }
}

// 开始建造导弹
function startMissileBuild(factoryTile) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const factory = factoryTile.building;
    const missileCost = BUILDINGS.missileFactory.missileCost;
    const maxMissiles = BUILDINGS.missileFactory.maxMissiles;
    
    if (!factory.storedMissiles) factory.storedMissiles = 0;
    
    if (factory.missileBuilding) {
        showNotification(`该工厂正在建造导弹中（剩余${factory.missileBuildTurns}回合）`, 'error');
        return false;
    }
    
    if (factory.storedMissiles >= maxMissiles) {
        showNotification(`导弹库存已满（${maxMissiles}/${maxMissiles}）！`, 'error');
        return false;
    }
    
    if (currentPlayer.gold < missileCost) {
        showNotification(`金币不足！建造导弹需要${missileCost}金币。`, 'error');
        return false;
    }
    
    currentPlayer.gold -= missileCost;
    factory.missileBuilding = true;
    factory.missileBuildTurns = BUILDINGS.missileFactory.missileBuildTime;
    
    addLogEntry(`${currentPlayer.name}开始在导弹工厂建造导弹，花费${missileCost}金币，${factory.missileBuildTurns}回合后完成。`);
    showNotification(`开始建造导弹，${factory.missileBuildTurns}回合后完成。`, 'success');
    
    updateGameStateDisplay();
    return true;
}

// 发射导弹（AoE攻击）
function launchMissile(factoryTile, targetX, targetY) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const factory = factoryTile.building;
    
    if (!factory.storedMissiles || factory.storedMissiles <= 0) {
        showNotification('没有可发射的导弹！', 'error');
        return false;
    }
    
    factory.storedMissiles--;
    
    let radius = 3;
    let damageMultiplier = 1.0;
    
    // 词条：导弹专家 - 伤害+50%，半径+1
    if (currentPlayer.enchantments && currentPlayer.enchantments.includes('missileExpert')) {
        damageMultiplier = 1.5;
        radius = 4;
    }
    
    let totalDamageDealt = 0;
    let buildingsHit = 0;
    let unitsHit = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = targetX + dx;
            const ny = targetY + dy;
            
            if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
            
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist > radius) continue;
            
            const idx = ny * GRID_WIDTH + nx;
            const tile = gameState.map[idx];
            
            // 对建筑造成伤害：敌方建筑 + 己方海盗船（均可被导弹破坏）
            const bOwner = getTileBuildingOwnerId(tile);
            const isEnemyBuilding = tile.building && bOwner !== null && bOwner >= 0 && bOwner !== currentPlayer.id;
            const isOwnPirateShip = tile.building && tile.building.type === 'pirateShip' && bOwner === currentPlayer.id;
            if (tile.building && (isEnemyBuilding || isOwnPirateShip)) {
                let damage = Math.floor((100 + Math.random() * 101) * damageMultiplier);
                
                let actualBuildingTile = tile;
                if (tile.building.type === 'city' && tile.building.isCityPart) {
                    const anchorIdx = tile.building.cityAnchorY * GRID_WIDTH + tile.building.cityAnchorX;
                    actualBuildingTile = gameState.map[anchorIdx];
                }
                
                const bType = actualBuildingTile.building.type;
                const bName = actualBuildingTile.building.name;
                
                if (bType === 'capital') {
                    damage = Math.floor(damage * 0.3);
                }
                
                ensureFiniteBuildingHealthBeforeDamage(actualBuildingTile.building);
                const oldHealth = actualBuildingTile.building.health;
                let newHealth = Math.max(0, oldHealth - damage);
                actualBuildingTile.building.health = newHealth;
                
                if (bType === 'city' && actualBuildingTile.building.isCityAnchor) {
                    const ax = actualBuildingTile.building.anchorX;
                    const ay = actualBuildingTile.building.anchorY;
                    const cityTiles = [
                        { tx: ax + 1, ty: ay }, { tx: ax, ty: ay + 1 }, { tx: ax + 1, ty: ay + 1 }
                    ];
                    for (const { tx, ty } of cityTiles) {
                        if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
                            const ci = ty * GRID_WIDTH + tx;
                            if (gameState.map[ci].building && gameState.map[ci].building.type === 'city') {
                                gameState.map[ci].building.health = newHealth;
                            }
                        }
                    }
                }
                
                totalDamageDealt += damage;
                buildingsHit++;
                
                if (newHealth <= 0) {
                    if (bType === 'capital') {
                        destroyAllPlayerAssets(tile.ownerId);
                        checkGameOver();
                    } else if (bType === 'city' && actualBuildingTile.building.isCityAnchor) {
                        const ax = actualBuildingTile.building.anchorX;
                        const ay = actualBuildingTile.building.anchorY;
                        const cTiles = [
                            { tx: ax, ty: ay }, { tx: ax + 1, ty: ay },
                            { tx: ax, ty: ay + 1 }, { tx: ax + 1, ty: ay + 1 }
                        ];
                        for (const { tx, ty } of cTiles) {
                            if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
                                gameState.map[ty * GRID_WIDTH + tx].building = null;
                            }
                        }
                    } else {
                        const bSnap = actualBuildingTile.building;
                        const bx = actualBuildingTile.x;
                        const by = actualBuildingTile.y;
                        const bOwn = bOwner;
                        actualBuildingTile.building = null;
                        if (bType === 'territoryExpander' && bOwn != null && bOwn >= 0) {
                            revertTerritoryExpanderClaims(bx, by, bSnap.expanderClaimedCells, bOwn);
                        }
                    }
                    addLogEntry(`导弹摧毁了${bName}！`);
                }
            }
            
            // 对敌方军事单位造成伤害
            if (tile.unit && tile.unit.ownerId !== currentPlayer.id) {
                let unitDamage = Math.floor((80 + Math.random() * 81) * damageMultiplier);
                const unit = tile.unit;
                const unitDef = UNITS[unit.type];
                const unitName = unitDef ? unitDef.name : '未知单位';
                
                const oldHP = unit.health;
                unit.health = Math.max(0, oldHP - unitDamage);
                
                totalDamageDealt += unitDamage;
                unitsHit++;
                
                if (unit.health <= 0) {
                    if (unit.ownerId >= 0 && gameState.players[unit.ownerId]) {
                        const defenderPlayer = gameState.players[unit.ownerId];
                        const ui = defenderPlayer.units.findIndex(u => u.id === unit.id);
                        if (ui !== -1) defenderPlayer.units.splice(ui, 1);
                        checkPlayerDefeat(unit.ownerId);
                    }
                    tile.unit = null;
                    recordPlayerKill(currentPlayer.id);
                    addLogEntry(`导弹炸死了敌方${unitName}！`);
                } else {
                    addLogEntry(`导弹对敌方${unitName}造成${unitDamage}点伤害（${oldHP}→${unit.health}）`);
                }
            }
        }
    }
    
    let hitSummary = [];
    if (buildingsHit > 0) hitSummary.push(`${buildingsHit}座建筑`);
    if (unitsHit > 0) hitSummary.push(`${unitsHit}个单位`);
    const hitStr = hitSummary.length > 0 ? hitSummary.join('和') : '无目标';
    
    addLogEntry(`${currentPlayer.name}向(${targetX},${targetY})发射导弹！命中${hitStr}，总计造成${totalDamageDealt}点伤害。`);
    showNotification(`导弹命中${hitStr}，造成${totalDamageDealt}点伤害！`, 'success');
    
    // 同步所有受影响玩家的建筑数据
    for (let p = 0; p < gameState.players.length; p++) {
        syncPlayerBuildings(p);
        updatePlayerIncome(gameState.players[p]);
    }
    
    updateGameStateDisplay();
    drawMap();
    return true;
}

// 格式化数字为带千分位的格式
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ====================== AI 电脑玩家逻辑 ======================

function executeAITurn() {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player || !player.isAI || player.isDefeated || gameState.isGameOver) return;
    
    gameState.aiExecuting = true;
    addLogEntry(`🤖 ${player.name}正在思考...`);
    
    const actions = [];
    
    // 1. 经济建设：优先建造收入建筑
    aiBuildEconomy(player, actions);
    
    // 2. 军事建设：有钱就造兵营和单位
    aiBuildMilitary(player, actions);
    
    // 3. 移动和攻击
    aiMoveAndAttack(player, actions);
    
    // 执行完所有操作后结束回合
    setTimeout(() => {
        gameState.aiExecuting = false;
        endTurn();
    }, 400);
}

function aiBuildEconomy(player, actions) {
    const ownedTiles = [];
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.ownerId === player.id && !tile.building && !tile.unit && tile.terrain !== 'water') {
            const inQueue = gameState.buildingQueue.some(bp => bp.x === tile.x && bp.y === tile.y);
            if (!inQueue) ownedTiles.push(tile);
        }
    }
    
    if (ownedTiles.length === 0) return;
    
    // 优先级：矿场（山地）> 农场 > 贸易站
    const mountainTiles = ownedTiles.filter(t => t.terrain === 'mountain');
    
    // 造矿场
    if (mountainTiles.length > 0 && player.gold >= BUILDINGS.mine.cost) {
        const t = mountainTiles[Math.floor(Math.random() * mountainTiles.length)];
        startBuilding(t.x, t.y, 'mine');
        actions.push('mine');
    }
    
    // 造农场
    const plainTiles = ownedTiles.filter(t => t.terrain !== 'mountain');
    if (plainTiles.length > 0 && player.gold >= BUILDINGS.farm.cost) {
        const farmCount = player.buildings.filter(b => b.type === 'farm').length;
        const queueFarms = gameState.buildingQueue.filter(bp => bp.type === 'farm' && bp.ownerId === player.id).length;
        if (farmCount + queueFarms < 3) {
            const t = plainTiles[Math.floor(Math.random() * plainTiles.length)];
            startBuilding(t.x, t.y, 'farm');
            actions.push('farm');
        }
    }
    
    // 有余钱造银行
    if (player.gold >= BUILDINGS.bank.cost + 200 && plainTiles.length > 1) {
        const bankCount = player.buildings.filter(b => b.type === 'bank').length;
        if (bankCount < 1) {
            const available = plainTiles.filter(t => !gameState.buildingQueue.some(bp => bp.x === t.x && bp.y === t.y));
            if (available.length > 0) {
                const t = available[Math.floor(Math.random() * available.length)];
                startBuilding(t.x, t.y, 'bank');
                actions.push('bank');
            }
        }
    }
    
    // 造防御塔
    if (player.gold >= BUILDINGS.tower.cost && plainTiles.length > 0) {
        const towerCount = player.buildings.filter(b => b.type === 'tower').length;
        if (towerCount < 2) {
            const available = plainTiles.filter(t => !gameState.buildingQueue.some(bp => bp.x === t.x && bp.y === t.y));
            if (available.length > 0) {
                const t = available[Math.floor(Math.random() * available.length)];
                startBuilding(t.x, t.y, 'tower');
                actions.push('tower');
            }
        }
    }
}

function aiBuildMilitary(player, actions) {
    const hasBarracks = player.buildings.some(b => b.type === 'barracks');
    const hasArmory = player.buildings.some(b => b.type === 'armoryFactory');
    const barracksInQueue = gameState.buildingQueue.some(bp => bp.type === 'barracks' && bp.ownerId === player.id);
    
    // 没有兵营就造兵营
    if (!hasBarracks && !barracksInQueue && player.gold >= BUILDINGS.barracks.cost) {
        const ownedTiles = [];
        for (let i = 0; i < gameState.map.length; i++) {
            const tile = gameState.map[i];
            if (tile.ownerId === player.id && !tile.building && !tile.unit && tile.terrain !== 'water' && tile.terrain !== 'mountain') {
                if (!gameState.buildingQueue.some(bp => bp.x === tile.x && bp.y === tile.y)) {
                    ownedTiles.push(tile);
                }
            }
        }
        if (ownedTiles.length > 0) {
            const t = ownedTiles[Math.floor(Math.random() * ownedTiles.length)];
            startBuilding(t.x, t.y, 'barracks');
            actions.push('barracks');
        }
    }
    
    // 有兵营后造兵
    if (hasBarracks && player.gold >= 100) {
        const unitCount = gameState.map.filter(t => t.unit && t.unit.ownerId === player.id).length;
        if (unitCount < 5) {
            // 找兵营附近的空位
            const barracksLocations = [];
            for (let i = 0; i < gameState.map.length; i++) {
                const tile = gameState.map[i];
                if (tile.ownerId === player.id && tile.building && tile.building.type === 'barracks') {
                    barracksLocations.push(tile);
                }
            }
            
            for (const bTile of barracksLocations) {
                const nearbyEmpty = findNearbyEmptyTile(bTile.x, bTile.y, player.id);
                if (nearbyEmpty) {
                    // 选择可负担的单位
                    let unitType = 'infantry';
                    if (hasArmory && player.gold >= (UNITS.tank ? UNITS.tank.cost : 999)) {
                        unitType = 'tank';
                    } else if (player.gold >= (UNITS.archer ? UNITS.archer.cost : 500)) {
                        unitType = Math.random() < 0.4 ? 'archer' : 'infantry';
                    }
                    
                    if (UNITS[unitType] && player.gold >= UNITS[unitType].cost) {
                        recruitUnit(nearbyEmpty.x, nearbyEmpty.y, unitType);
                        actions.push(unitType);
                        break;
                    }
                }
            }
        }
    }
}

function aiMoveAndAttack(player, actions) {
    const myUnits = [];
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.unit && tile.unit.ownerId === player.id && !tile.unit.hasActed) {
            myUnits.push({ tile, x: tile.x, y: tile.y });
        }
    }
    
    for (const { tile: unitTile, x: ux, y: uy } of myUnits) {
        const unit = unitTile.unit;
        if (!unit || unit.hasActed) continue;
        
        if (unit.type === 'doctor') {
            if (!unit.hasAttacked) {
                let bestTile = null;
                let bestPct = 1;
                const hr = UNITS.doctor.healRange != null ? UNITS.doctor.healRange : UNITS.doctor.attackRange;
                for (let i = 0; i < gameState.map.length; i++) {
                    const t = gameState.map[i];
                    if (!t.unit || t.unit.ownerId !== player.id) continue;
                    const dist = Math.abs(t.x - ux) + Math.abs(t.y - uy);
                    if (dist > hr || dist === 0) continue;
                    const tgt = t.unit;
                    const maxH = tgt.maxHealth || UNITS[tgt.type].health;
                    if (tgt.health >= maxH) continue;
                    const pct = tgt.health / maxH;
                    if (pct < bestPct) {
                        bestPct = pct;
                        bestTile = t;
                    }
                }
                if (bestTile) {
                    gameState.selectedUnit = unit;
                    healTarget(ux, uy, bestTile.x, bestTile.y);
                    actions.push('heal');
                }
            }
            continue;
        }
        
        // 寻找最近的敌方目标
        let nearestEnemy = null;
        let nearestDist = Infinity;
        
        for (let i = 0; i < gameState.map.length; i++) {
            const t = gameState.map[i];
            const bOwn = t.building ? getTileBuildingOwnerId(t) : null;
            const isEnemyBuilding = t.building && bOwn !== null && bOwn >= 0 && bOwn !== player.id;
            const isEnemy = (t.unit && t.unit.ownerId !== player.id) || isEnemyBuilding;
            if (isEnemy) {
                const dist = Math.abs(t.x - ux) + Math.abs(t.y - uy);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = t;
                }
            }
        }
        
        if (!nearestEnemy) continue;
        
        const unitDef = UNITS[unit.type];
        const moveRange = unitDef ? unitDef.moveRange : 2;
        const attackRange = unitDef ? unitDef.attackRange : 1;
        
        // 如果在攻击范围内，直接攻击
        if (nearestDist <= attackRange && !unit.hasAttacked) {
            gameState.selectedUnit = unit;
            gameState.selectedTile = { x: ux, y: uy };
            
            attackTarget(ux, uy, nearestEnemy.x, nearestEnemy.y);
            actions.push('attack');
            continue;
        }
        
        // 否则向敌方方向移动
        if (!unit.hasMoved) {
            let bestX = ux, bestY = uy;
            let bestDist = nearestDist;
            
            for (let dy = -moveRange; dy <= moveRange; dy++) {
                for (let dx = -moveRange; dx <= moveRange; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) > moveRange) continue;
                    const nx = ux + dx;
                    const ny = uy + dy;
                    if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
                    
                    const idx = ny * GRID_WIDTH + nx;
                    const target = gameState.map[idx];
                    if (target.unit || target.building || target.terrain === 'water') continue;
                    
                    const distToEnemy = Math.abs(target.x - nearestEnemy.x) + Math.abs(target.y - nearestEnemy.y);
                    if (distToEnemy < bestDist) {
                        bestDist = distToEnemy;
                        bestX = nx;
                        bestY = ny;
                    }
                }
            }
            
            if (bestX !== ux || bestY !== uy) {
                moveUnitDirect(ux, uy, bestX, bestY);
                actions.push('move');
            }
        }
    }
}

function findNearbyEmptyTile(cx, cy, playerId) {
    for (let r = 1; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > r) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
                const idx = ny * GRID_WIDTH + nx;
                const tile = gameState.map[idx];
                if (tile.ownerId === playerId && !tile.building && !tile.unit && tile.terrain !== 'water') {
                    return tile;
                }
            }
        }
    }
    return null;
}

function moveUnitDirect(fromX, fromY, toX, toY) {
    const fromIdx = fromY * GRID_WIDTH + fromX;
    const toIdx = toY * GRID_WIDTH + toX;
    const fromTile = gameState.map[fromIdx];
    const toTile = gameState.map[toIdx];
    
    if (!fromTile.unit) return false;
    
    const unit = fromTile.unit;
    toTile.unit = unit;
    fromTile.unit = null;
    unit.hasMoved = true;
    
    // 占领领土
    const player = gameState.players[unit.ownerId];
    if (toTile.ownerId !== unit.ownerId) {
        toTile.ownerId = unit.ownerId;
    }
    
    return true;
}

// 在页面加载完成后初始化游戏
window.addEventListener('load', initGame); 