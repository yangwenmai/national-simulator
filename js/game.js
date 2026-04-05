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
function startNewGame(playerCount = 2) {
    console.log("开始新游戏，传入的玩家数量：", playerCount);
    
    // 确保玩家数量在2-5之间
    playerCount = Math.min(Math.max(playerCount, 2), 5);
    console.log("调整后的玩家数量：", playerCount);
    
    // 初始化游戏状态
    initGameState(playerCount);
    console.log("游戏状态初始化完成，玩家数组长度：", gameState.players.length);
    
    // 初始化地图
    gameState.map = initializeMap();
    
    // 生成随机地形
    generateRandomTerrain(gameState.map);
    
    // 生成玩家起始区域
    generatePlayerStartingAreas(gameState.map, playerCount);
    
    // 为所有玩家同步建筑数据
    for (let i = 0; i < gameState.players.length; i++) {
        syncPlayerBuildings(i);
        updatePlayerIncome(gameState.players[i]);
    }
    
    // 更新游戏显示
    updateGameStateDisplay();
    
    // 绘制地图
    drawMap();
    
    // 添加游戏开始日志
    addLogEntry(`游戏开始！共${playerCount}个玩家参与。`);
}

// 初始化游戏状态
function initGameState(playerCount) {
    console.log("初始化游戏状态，玩家数量：", playerCount);
    
    gameState = {
        map: [],
        players: [],
        currentPlayerIndex: 0,
        turn: 1,
        selectedTile: null,
        selectedUnit: null,
        buildMode: false,
        selectedBuildingType: null,
        buildingQueue: [], // 建筑队列，而不是单一的buildingInProgress
        moveMode: false,
        attackMode: false,
        repairMode: false,
        recruitMode: false,
        selectedUnitType: null,
        isGameOver: false,
        winner: null,
        factoryProduction: {
            armoryFactoryBuiltThisRound: 0,
            bigArmoryFactoryBuiltThisRound: 0,
            barracksBuiltThisRound: 0
        },
        // 领土控制相关
        territoryControlMax: 100,
        territoryControlLossPerTurn: 20,
        // 游戏时间相关
        gameStartTime: Date.now(),
        gameTotalTime: 0,
        currentTurnStartTime: Date.now(),
        playerTurnTimes: [] // 存储每个玩家在当前回合的用时
    };
    
    // 创建玩家
    for (let i = 0; i < playerCount; i++) {
        // 检查是否有足够的颜色
        if (i >= PLAYER_COLORS.length) {
            console.error(`警告：没有为玩家${i+1}定义颜色！`);
        }
        
        gameState.players.push({
            id: i,
            name: `玩家${i + 1}`,
            color: PLAYER_COLORS[i],
            gold: INITIAL_GOLD,
            income: 0,
            militaryMaintenance: 0,
            buildings: [],
            units: [],
            enchantments: [],
            isDefeated: false,
            totalTurnTime: 0,
            currentTurnTime: 0,
            turnCount: 0,
            maxTurnTime: 0,
            minTurnTime: Infinity
        });
        
        gameState.playerTurnTimes.push(0); // 初始化每个玩家的回合用时
        
        console.log(`创建玩家${i+1}，颜色：`, PLAYER_COLORS[i]);
    }
    
    console.log("游戏状态初始化完成，玩家数组：", gameState.players);
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
    
    // 保存当前玩家建筑到玩家buildings列表
    syncPlayerBuildings(currentPlayer.id);
    
    // 切换到下一个未被击败的玩家
    do {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        
        // 如果回到第一个玩家，增加回合数
        if (gameState.currentPlayerIndex === 0) {
            gameState.turn++;
            
            // 重置军事建筑建造计数
            gameState.factoryProduction = {
                armoryFactoryBuiltThisRound: 0,
                bigArmoryFactoryBuiltThisRound: 0,
                barracksBuiltThisRound: 0
            };
        }
    } while (gameState.players[gameState.currentPlayerIndex].isDefeated);
    
    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 重置当前回合开始时间
    gameState.currentTurnStartTime = Date.now();
    
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
    
    // 清空当前建筑列表
    player.buildings = [];
    
    // 从地图重建建筑列表（城市只计入锚点，跳过isCityPart）
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.ownerId === playerId && tile.building) {
            if (tile.building.isCityPart) continue;
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
    
    // 获取建筑总建造时间（如果未定义，默认为2回合）
    let buildTime = BUILDINGS[buildingType].buildTime || 2;
    
    // 词条：快速建造 - 建造时间减少1回合（最低1回合）
    if (currentPlayer.enchantments && currentPlayer.enchantments.includes('fastBuild')) {
        buildTime = Math.max(1, buildTime - 1);
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
    
    // 检查是否是军厂或大军厂，增加计数
    if (buildingType === 'armoryFactory') {
        gameState.factoryProduction.armoryFactoryBuiltThisRound++;
    } else if (buildingType === 'bigArmoryFactory') {
        gameState.factoryProduction.bigArmoryFactoryBuiltThisRound++;
    } else if (buildingType === 'barracks') {
        gameState.factoryProduction.barracksBuiltThisRound++;
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
    
    // 设置到地图上
    tile.building = newBuilding;
    
    // 更新玩家的收入
    updatePlayerIncome(currentPlayer);
    
    // 添加到玩家建筑列表
    currentPlayer.buildings.push(newBuilding);
    
    // 扩张领土
    expandTerritory(x, y, currentPlayer.id);
    
    // 添加游戏日志
    addLogEntry(`${currentPlayer.name}在坐标(${x}, ${y})建造了${BUILDINGS[buildingType].name}，花费${buildingCost}金币。`);
    
    // 显示通知
    showNotification(`建造${BUILDINGS[buildingType].name}成功！`);
    
    return true;
}

// 处理医院治疗单位
function processHospitalHealing() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const healAmount = 20; // 每次治疗恢复的生命值
    
    // 查找当前玩家所有的医院和大医院
    const hospitals = [];
    const bigHospitals = [];
    
    gameState.map.forEach(tile => {
        if (tile.ownerId === currentPlayer.id && tile.building) {
            if (tile.building.type === 'hospital') {
                hospitals.push(tile);
            } else if (tile.building.type === 'bigHospital') {
                bigHospitals.push(tile);
            }
        }
    });
    
    // 处理普通医院治疗（每个医院治疗1个单位）
    hospitals.forEach(hospitalTile => {
        // 寻找附近的受伤单位（优先治疗伤势最重的）
        const injuredUnitInfo = findNearbyInjuredUnit(hospitalTile.x, hospitalTile.y);
        
        if (injuredUnitInfo) {
            healUnit(injuredUnitInfo.unit, healAmount);
            
            // 更新地图上的单位状态
            gameState.map[injuredUnitInfo.tileIndex].unit.health = injuredUnitInfo.unit.health;
            
            addLogEntry(`${currentPlayer.name}的医院治疗了一个${UNITS[injuredUnitInfo.unit.type].name}，恢复了${healAmount}点生命值。`);
        }
    });
    
    // 处理大医院治疗（每个大医院治疗3个单位）
    bigHospitals.forEach(hospitalTile => {
        let healsRemaining = 3; // 大医院每回合可以治疗3个单位
        
        while (healsRemaining > 0) {
            // 寻找附近的受伤单位
            const injuredUnitInfo = findNearbyInjuredUnit(hospitalTile.x, hospitalTile.y);
            
            if (injuredUnitInfo) {
                healUnit(injuredUnitInfo.unit, healAmount);
                
                // 更新地图上的单位状态
                gameState.map[injuredUnitInfo.tileIndex].unit.health = injuredUnitInfo.unit.health;
                
                addLogEntry(`${currentPlayer.name}的大医院治疗了一个${UNITS[injuredUnitInfo.unit.type].name}，恢复了${healAmount}点生命值。`);
                healsRemaining--;
            } else {
                // 没有更多受伤单位了
                break;
            }
        }
    });
}

// 寻找附近受伤的单位（优先找生命值百分比最低的）
function findNearbyInjuredUnit(x, y, range = 3) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let injuredUnits = [];
    
    // 查找范围内的所有受伤单位
    for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            // 确保在地图范围内
            if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                const tileIndex = ny * GRID_WIDTH + nx;
                const tile = gameState.map[tileIndex];
                
                // 检查是否是当前玩家的受伤单位
                if (tile.unit && 
                    tile.unit.ownerId === currentPlayer.id && 
                    tile.unit.health < UNITS[tile.unit.type].health) {
                    
                    // 计算生命值百分比
                    const healthPercent = tile.unit.health / UNITS[tile.unit.type].health;
                    
                    injuredUnits.push({
                        unit: tile.unit,
                        healthPercent: healthPercent,
                        tileIndex: tileIndex
                    });
                }
            }
        }
    }
    
    // 按生命值百分比升序排序（优先治疗生命值百分比最低的）
    injuredUnits.sort((a, b) => a.healthPercent - b.healthPercent);
    
    // 返回生命值百分比最低的单位和对应的tile索引
    return injuredUnits.length > 0 ? { unit: injuredUnits[0].unit, tileIndex: injuredUnits[0].tileIndex } : null;
}

// 治疗单位
function healUnit(unit, amount) {
    const maxHealth = UNITS[unit.type].health;
    
    // 增加生命值但不超过最大值
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
            tile.unit.health < UNITS[tile.unit.type].health * 0.1) { // 血量低于10%
            
            // 检查是否已经使用过复活能力
            if (tile.unit.hasResurrected) continue;
            
            // 复活单位（恢复满血）
            tile.unit.health = UNITS[tile.unit.type].health;
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
    
    // 检查是否拥有魔法学院
    const hasMagicAcademy = currentPlayer.buildings.some(b => b.type === 'magicAcademy');
    if (!hasMagicAcademy) {
        showNotification('需要建造魔法学院才能购买词条！', 'error');
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
    if (enchantmentId === 'economicBoom') {
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
            const maxHealth = UNITS[tile.unit.type].health;
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
    
    if (tile.ownerId !== currentPlayer.id || !tile.building) {
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
    tile.building = null;
    
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

// 格式化数字为带千分位的格式
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 在页面加载完成后初始化游戏
window.addEventListener('load', initGame); 