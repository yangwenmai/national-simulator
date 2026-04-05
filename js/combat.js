// 战斗系统相关功能

// 移动单位
function moveUnit(fromX, fromY, toX, toY) {
    const fromTileIndex = fromY * GRID_WIDTH + fromX;
    const toTileIndex = toY * GRID_WIDTH + toX;
    
    // 获取源格子和目标格子
    const fromTile = gameState.map[fromTileIndex];
    const toTile = gameState.map[toTileIndex];
    
    // 检查源格子是否有单位
    if (!fromTile.unit) {
        showNotification('没有单位可以移动！', 'error');
        return false;
    }
    
    // 检查目标格子是否已经有单位
    if (toTile.unit) {
        showNotification('目标位置已经有单位！', 'error');
        return false;
    }
    
    const unit = fromTile.unit;
    const unitType = unit.type;
    const moveRange = UNITS[unitType].moveRange;
    
    // 计算曼哈顿距离
    const distance = Math.abs(fromX - toX) + Math.abs(fromY - toY);
    
    // 检查是否在移动范围内
    if (distance > moveRange) {
        showNotification('超出移动范围！', 'error');
        return false;
    }
    
    // 检查非空中单位是否可以通过地形
    if (unitType !== 'air' && toTile.terrain === 'water') {
        showNotification('该单位不能在水上移动！', 'error');
        return false;
    }
    
    // 检查油车是否试图进入有建筑的格子
    if (unitType === 'oilCar' && toTile.building) {
        showNotification('油车不能进入已有建筑的格子！', 'error');
        return false;
    }
    
    // 设置行动标记
    const unitOwner = gameState.players[unit.ownerId];
    if (playerHasCity(unitOwner)) {
        // 有城市：移动后仍可攻击
        unit.hasMoved = true;
        unit.hasActed = unit.hasAttacked ? true : false;
    } else {
        unit.hasActed = true;
    }
    
    // 更新单位位置
    unit.x = toX;
    unit.y = toY;
    
    // 将单位从源格子移动到目标格子
    toTile.unit = unit;
    fromTile.unit = null;
    
    // 处理油车进入敌方领地的特殊情况
    if (unitType === 'oilCar' && toTile.ownerId !== null && toTile.ownerId !== unit.ownerId) {
        // 初始化油车占领计时器
        unit.territoryClaimTimer = UNITS.oilCar.claimCountdown;
        
        // 添加游戏日志
        const unitOwner = gameState.players[unit.ownerId];
        const tileOwner = gameState.players[toTile.ownerId];
        addLogEntry(`${unitOwner.name}的油车进入了${tileOwner.name}的领地，将在${unit.territoryClaimTimer}回合后占领此地。`);
        
        // 显示通知
        showNotification(`油车进入敌方领地，${unit.territoryClaimTimer}回合后将占领此地！`, 'info');
    }
    
    // 更新游戏日志
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    addLogEntry(`${currentPlayer.name}的${UNITS[unitType].name}从(${fromX}, ${fromY})移动到(${toX}, ${toY})。`);
    
    return true;
}

// 攻击目标
function attackTarget(attackerX, attackerY, targetX, targetY) {
    const attackerTileIndex = attackerY * GRID_WIDTH + attackerX;
    const targetTileIndex = targetY * GRID_WIDTH + targetX;
    
    // 获取攻击者和目标格子
    const attackerTile = gameState.map[attackerTileIndex];
    const targetTile = gameState.map[targetTileIndex];
    
    // 检查攻击者格子是否有单位
    if (!attackerTile.unit) {
        showNotification('没有单位可以攻击！', 'error');
        return false;
    }
    
    const attacker = attackerTile.unit;
    const attackerType = attacker.type;
    const attackRange = UNITS[attackerType].attackRange;
    
    // 计算曼哈顿距离
    const distance = Math.abs(attackerX - targetX) + Math.abs(attackerY - targetY);
    
    // 检查是否在攻击范围内
    if (distance > attackRange) {
        showNotification('超出攻击范围！', 'error');
        return false;
    }
    
    // 检查攻击者和攻击目标
    const attackerOwnerId = attacker.ownerId;
    
    // 根据目标类型进行不同的判断
    if (targetTile.unit) {
        // 如果目标是单位，检查单位所有者
        if (targetTile.unit.ownerId === attackerOwnerId) {
            showNotification('不能攻击自己的单位！', 'error');
            return false;
        }
    } else if (targetTile.building) {
        // 如果目标是建筑，检查地块所有者
        if (targetTile.ownerId === attackerOwnerId) {
            showNotification('不能攻击自己的建筑！', 'error');
            return false;
        }
    } else {
        // 如果没有单位也没有建筑，则无法攻击
        showNotification('没有可攻击的目标！', 'error');
        return false;
    }
    
    // 设置行动标记
    const atkOwner = gameState.players[attacker.ownerId];
    if (playerHasCity(atkOwner)) {
        attacker.hasAttacked = true;
        attacker.hasActed = attacker.hasMoved ? true : false;
    } else {
        attacker.hasActed = true;
    }
    
    // 计算攻击伤害
    let damage, defender;
    
    if (targetTile.unit) {
        // 对敌方单位造成伤害
        defender = targetTile.unit;
        damage = calculateDamage(attacker, defender);
        
        // 确保伤害是一个有效数值
        if (isNaN(damage)) {
            console.warn('计算出的伤害值为NaN，已修正为默认值5');
            damage = 5;
        }
        
        // 应用伤害
        defender.health -= damage;
        
        // 修复NaN问题
        if (isNaN(defender.health)) {
            defender.health = 0;
            console.log(`修复了一个单位健康值为NaN的问题：${UNITS[defender.type].name}`);
        }
        
        // 检查单位是否被摧毁
        if (defender.health <= 0) {
            // 移除被摧毁的单位
            targetTile.unit = null;
            
            // 更新游戏日志
            const attackerPlayer = gameState.players[attackerOwnerId];
            const defenderPlayer = gameState.players[defender.ownerId];
            
            addLogEntry(`${attackerPlayer.name}的${UNITS[attackerType].name}摧毁了${defenderPlayer.name}的${UNITS[defender.type].name}，造成了${isNaN(damage) ? 0 : damage}点伤害。`);
            
            showNotification(`敌方${UNITS[defender.type].name}被摧毁！`, 'success');
        } else {
            // 更新游戏日志
            const attackerPlayer = gameState.players[attackerOwnerId];
            const defenderPlayer = gameState.players[defender.ownerId];
            
            addLogEntry(`${attackerPlayer.name}的${UNITS[attackerType].name}攻击了${defenderPlayer.name}的${UNITS[defender.type].name}，造成了${isNaN(damage) ? 0 : damage}点伤害（剩余生命：${defender.health}）。`);
            
            showNotification(`对敌方${UNITS[defender.type].name}造成${isNaN(damage) ? 0 : damage}点伤害！`, 'info');
        }
    } else if (targetTile.building) {
        // 对敌方建筑造成伤害
        const targetOwnerId = targetTile.ownerId;
        let actualBuildingTile = targetTile;
        
        // 城市伤害重定向：如果攻击的是城市非锚点部分，将伤害转移到锚点
        if (targetTile.building.type === 'city' && targetTile.building.isCityPart) {
            const anchorIdx = targetTile.building.cityAnchorY * GRID_WIDTH + targetTile.building.cityAnchorX;
            actualBuildingTile = gameState.map[anchorIdx];
        }
        
        const buildingType = actualBuildingTile.building.type;
        const buildingName = actualBuildingTile.building.name;
        const attackerPlayer = gameState.players[attackerOwnerId];
        const defenderPlayer = gameState.players[targetOwnerId];
        
        damage = calculateBuildingDamage(attacker, actualBuildingTile.building);
        
        if (isNaN(damage)) {
            console.warn('计算出的建筑伤害值为NaN，已修正为默认值5');
            damage = 5;
        }
        
        const currentHealth = actualBuildingTile.building.health;
        const maxHealth = buildingType === 'capital' ? 
            BUILDINGS.capital.maxHealth : 
            BUILDINGS[buildingType].maxHealth;
        
        const newHealth = Math.max(0, currentHealth - damage);
        actualBuildingTile.building.health = newHealth;
        
        // 同步城市所有部分的血量
        if (buildingType === 'city' && actualBuildingTile.building.isCityAnchor) {
            const ax = actualBuildingTile.building.anchorX;
            const ay = actualBuildingTile.building.anchorY;
            const cityTiles = [
                { tx: ax + 1, ty: ay }, { tx: ax, ty: ay + 1 }, { tx: ax + 1, ty: ay + 1 }
            ];
            for (const { tx, ty } of cityTiles) {
                if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
                    const idx = ty * GRID_WIDTH + tx;
                    if (gameState.map[idx].building && gameState.map[idx].building.type === 'city') {
                        gameState.map[idx].building.health = newHealth;
                    }
                }
            }
        }
        
        if (newHealth <= 0) {
            if (buildingType === 'capital') {
                destroyAllPlayerAssets(targetOwnerId);
                checkGameOver();
            }
            
            // 城市摧毁：清除所有4个格子
            if (buildingType === 'city' && actualBuildingTile.building.isCityAnchor) {
                const ax = actualBuildingTile.building.anchorX;
                const ay = actualBuildingTile.building.anchorY;
                const cityTiles = [
                    { tx: ax, ty: ay }, { tx: ax + 1, ty: ay },
                    { tx: ax, ty: ay + 1 }, { tx: ax + 1, ty: ay + 1 }
                ];
                for (const { tx, ty } of cityTiles) {
                    if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
                        const idx = ty * GRID_WIDTH + tx;
                        gameState.map[idx].building = null;
                    }
                }
            } else {
                actualBuildingTile.building = null;
            }
            
            addLogEntry(`${attackerPlayer.name}的${UNITS[attackerType].name}摧毁了${defenderPlayer.name}的${buildingName}，造成了${isNaN(damage) ? 0 : damage}点伤害。`);
            showNotification(`敌方${buildingName}被摧毁！`, 'success');
        } else {
            addLogEntry(`${attackerPlayer.name}的${UNITS[attackerType].name}攻击了${defenderPlayer.name}的${buildingName}，造成了${isNaN(damage) ? 0 : damage}点伤害（剩余生命：${newHealth}/${maxHealth}）。`);
            showNotification(`对敌方${buildingName}造成${isNaN(damage) ? 0 : damage}点伤害！`, 'info');
            updateBuildingDamageEffect(actualBuildingTile, defenderPlayer);
        }
    } else {
        showNotification('没有目标可以攻击！', 'error');
        return false;
    }
    
    return true;
}

// 计算单位对单位的伤害
function calculateDamage(attacker, defender) {
    const attackerType = attacker.type;
    
    // 如果是教官单位，计算其动态攻击力
    if (attackerType === 'instructor' && UNITS[attackerType].dynamicAttack) {
        // 计算教官的攻击力，基于周围军事单位
        attacker.attack = calculateInstructorAttack(attacker);
    }
    
    // 获取攻击者和防御者的攻击和防御属性
    let attackPower = isNaN(attacker.attack) ? UNITS[attackerType].attack : attacker.attack; 
    const defensePower = isNaN(defender.defense) ? UNITS[defender.type].defense : defender.defense;
    
    // 处理魔法兵的魔法刀能力
    if (attackerType === 'magicSoldier' && UNITS[attackerType].hasMagicAbility) {
        // 50%概率触发魔法刀
        if (Math.random() < 0.5) {
            // 伤害翻倍
            attackPower *= 2;
            
            // 添加日志
            const attackerPlayer = gameState.players[attacker.ownerId];
            addLogEntry(`${attackerPlayer.name}的魔法兵触发了魔法刀，攻击力翻倍！`);
            showNotification('魔法刀触发！攻击力翻倍', 'success');
            
            // 获得随机buff
            applyMagicBuff(attacker, defender);
        }
    }
    
    // 处理反伤效果
    if (defender.type === 'magicSoldier' && defender.reflectionBuff) {
        // 反弹50%的伤害给攻击者
        let reflectedDamage = Math.floor(attackPower * 0.5);
        attacker.health -= reflectedDamage;
        
        // 添加日志
        const defenderPlayer = gameState.players[defender.ownerId];
        const attackerPlayer = gameState.players[attacker.ownerId];
        addLogEntry(`${defenderPlayer.name}的魔法兵反弹了${reflectedDamage}点伤害给${attackerPlayer.name}的${UNITS[attacker.type].name}！`);
        showNotification(`反伤效果触发！反弹了${reflectedDamage}点伤害`, 'info');
        
        // 使用后移除反伤buff
        defender.reflectionBuff = false;
    }
    
    // 词条：攻击强化 +20%
    const attackerPlayer = gameState.players[attacker.ownerId];
    if (attackerPlayer.enchantments && attackerPlayer.enchantments.includes('attackBoost')) {
        attackPower = Math.floor(attackPower * 1.2);
    }
    
    // 词条：防御强化 +20%（对防御方生效）
    let adjustedDefense = defensePower;
    const defenderPlayer = gameState.players[defender.ownerId];
    if (defenderPlayer.enchantments && defenderPlayer.enchantments.includes('defenseBoost')) {
        adjustedDefense = Math.floor(adjustedDefense * 1.2);
    }
    
    // 计算基础伤害（攻击力与防御力的差值，但最小为5）
    let damage = Math.max(attackPower - adjustedDefense, 5);
    
    // 检查指挥单位光环效果
    damage = applyCommandUnitEffect(attacker, damage);
    
    // 检查魔法学院光环效果
    damage = applyMagicAcademyEffect(attacker, damage);
    
    // 应用战术指导效果
    damage = applyTacticalGuidanceEffect(attacker, damage);
    
    // 确保返回一个有效的数值
    return isNaN(damage) ? 5 : Math.round(damage);
}

// 计算教官的动态攻击力
function calculateInstructorAttack(instructor) {
    const x = instructor.x;
    const y = instructor.y;
    const ownerId = instructor.ownerId;
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
            
            // 检查是否有军事单位（任何所有者的单位，不限于己方），排除教官
            if (tile.unit && tile.unit.type !== 'instructor') {
                // 是非教官军事单位
                const unitAttack = UNITS[tile.unit.type].attack;
                totalAttack += Math.floor(unitAttack / 2); // 取一半攻击力（向下取整）
                unitsCount++;
                
                // 最多只取3个单位
                if (unitsCount >= 3) {
                    break;
                }
            }
        }
    }
    
    return totalAttack;
}

// 将函数设为全局可访问，以便UI可以使用
window.calculateInstructorAttack = calculateInstructorAttack;

// 应用战术指导效果（教官对友方单位的加成）
function applyTacticalGuidanceEffect(unit, damage) {
    // 检查单位是否受到教官战术指导的加成
    if (unit.tacticalGuidanceBoost) {
        // 增加15%的攻击力
        damage = Math.floor(damage * 1.15);
    }
    return damage;
}

// 计算单位对建筑的伤害
function calculateBuildingDamage(attacker, building) {
    const attackerType = attacker.type;
    
    // 如果是教官单位，计算其动态攻击力
    if (attackerType === 'instructor' && UNITS[attackerType].dynamicAttack) {
        // 计算教官的攻击力，基于周围军事单位
        attacker.attack = calculateInstructorAttack(attacker);
    }
    
    // 获取基础攻击力，如果是NaN就使用单位类型的默认攻击力
    let baseAttack = isNaN(attacker.attack) ? UNITS[attackerType].attack : attacker.attack;
    
    // 处理魔法兵的魔法刀能力
    if (attackerType === 'magicSoldier' && UNITS[attackerType].hasMagicAbility) {
        // 50%概率触发魔法刀
        if (Math.random() < 0.5) {
            // 伤害翻倍
            baseAttack *= 2;
            
            // 添加日志
            const attackerPlayer = gameState.players[attacker.ownerId];
            addLogEntry(`${attackerPlayer.name}的魔法兵触发了魔法刀，攻击力翻倍！`);
            showNotification('魔法刀触发！攻击力翻倍', 'success');
            
            // 应用破甲buff
            building.armorBroken = true;
            addLogEntry(`${attackerPlayer.name}的魔法兵对建筑使用了破甲！`);
        }
    }
    
    // 计算随机因素 (0.9到1.1之间的随机值)
    const randomFactor = 0.9 + Math.random() * 0.2;
    
    // 计算伤害，建筑没有防御值，但伤害减少25%
    // 如果建筑有破甲效果，则不减少伤害
    let damage;
    if (building.armorBroken) {
        damage = Math.max(5, Math.round(baseAttack * randomFactor));
    } else {
        damage = Math.max(5, Math.round(baseAttack * 0.75 * randomFactor));
    }
    
    // 特殊单位类型的伤害修正
    if (attackerType === 'heavyTank') {
        damage *= 1.5; // 重型坦克对建筑伤害增加50%
    } else if (attackerType === 'bomber') {
        damage *= 2.0; // 轰炸机对建筑伤害翻倍
    }
    
    // 词条：精准打击 - 对建筑伤害+30%
    const atkPlayer = gameState.players[attacker.ownerId];
    if (atkPlayer.enchantments && atkPlayer.enchantments.includes('siegeMaster')) {
        damage *= 1.3;
    }
    
    // 词条：魔法屏障 - 建筑额外+15%伤害减免（需要找到建筑所属玩家）
    const buildingOwnerTile = gameState.map.find(t => t.building === building);
    if (buildingOwnerTile && buildingOwnerTile.ownerId !== null) {
        const defPlayer = gameState.players[buildingOwnerTile.ownerId];
        if (defPlayer && defPlayer.enchantments && defPlayer.enchantments.includes('magicBarrier')) {
            damage *= 0.85;
        }
    }
    
    // 检查魔法学院光环效果
    damage = applyMagicAcademyEffect(attacker, damage);
    
    // 确保计算结果是数值
    return isNaN(damage) ? 5 : Math.round(damage);
}

// 更新建筑损伤状态对收益的影响
function updateBuildingDamageEffect(tile, player) {
    if (!tile.building || tile.ownerId !== player.id) return;
    
    const building = tile.building;
    const buildingType = building.type;
    
    // 只处理有收入的建筑（包括有随机收入的建筑）
    if (!BUILDINGS[buildingType]) return;
    if (BUILDINGS[buildingType].income <= 0 && !BUILDINGS[buildingType].randomIncome) return;
    if (building.isCityPart) return; // 城市非锚点不处理
    
    // 获取建筑最大健康值
    let maxHealth;
    if (buildingType === 'capital') {
        maxHealth = BUILDINGS.capital.maxHealth;
    } else {
        maxHealth = BUILDINGS[buildingType].maxHealth;
    }
    
    // 计算健康百分比
    const healthPercent = building.health / maxHealth;
    
    // 根据健康状况调整收入
    let incomeMultiplier;
    if (healthPercent > 0.7) {
        incomeMultiplier = 1.0; // 健康 - 正常收入
    } else if (healthPercent > 0.3) {
        incomeMultiplier = 0.7; // 受损 - 收入降低30%
    } else {
        incomeMultiplier = 0.4; // 严重受损 - 收入降低60%
    }
    
    // 调整建筑收入
    building.adjustedIncome = Math.round(BUILDINGS[buildingType].income * incomeMultiplier);
    
    // 更新玩家总收入
    updatePlayerIncome(player);
}

// 摧毁玩家的所有资产（首都被摧毁时）
function destroyAllPlayerAssets(playerId) {
    const player = gameState.players[playerId];
    
    // 更新玩家状态
    player.isDefeated = true;
    player.income = 0;
    player.buildings = [];
    
    // 移除玩家在地图上的所有资产
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        
        if (tile.ownerId === playerId) {
            // 移除所属权
            tile.ownerId = null;
            
            // 移除建筑和单位
            tile.building = null;
            if (tile.unit && tile.unit.ownerId === playerId) {
                tile.unit = null;
            }
        } else if (tile.unit && tile.unit.ownerId === playerId) {
            // 移除玩家的单位（可能在敌方领土上）
            tile.unit = null;
        }
    }
    
    // 添加游戏日志
    addLogEntry(`${player.name}的首都被摧毁，该国家被彻底击败！`);
    
    showNotification(`${player.name}被击败！`, 'info');
}

// 检查游戏是否结束
function checkGameOver() {
    // 统计未被击败的玩家数量
    let activePlayerCount = 0;
    let lastActivePlayerIndex = -1;
    
    for (let i = 0; i < gameState.players.length; i++) {
        if (!gameState.players[i].isDefeated) {
            activePlayerCount++;
            lastActivePlayerIndex = i;
        }
    }
    
    // 如果只剩一个玩家，游戏结束
    if (activePlayerCount === 1) {
        const winner = gameState.players[lastActivePlayerIndex];
        
        // 更新游戏状态
        gameState.isGameOver = true;
        gameState.winner = winner;
        
        // 记录游戏结束时间
        gameState.gameTotalTime = Date.now() - gameState.gameStartTime;
        
        // 清除计时器
        if (gameState._timerInterval) {
            clearInterval(gameState._timerInterval);
            gameState._timerInterval = null;
        }
        
        // 添加游戏日志
        const gameDuration = Math.floor(gameState.gameTotalTime / 1000);
        const hours = Math.floor(gameDuration / 3600);
        const minutes = Math.floor((gameDuration % 3600) / 60);
        const seconds = gameDuration % 60;
        const timeStr = `${hours}小时${minutes}分${seconds}秒`;
        
        addLogEntry(`游戏结束！${winner.name}获得了胜利！游戏时长：${timeStr}`);
        
        showNotification(`${winner.name}获得了胜利！`, 'success');
        
        // 显示游戏结束画面
        showGameOverScreen(winner);
    }
    
    return gameState.isGameOver;
}

// 招募军事单位
function recruitUnit(x, y, unitType) {
    const tileIndex = y * GRID_WIDTH + x;
    const tile = gameState.map[tileIndex];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 检查是否是玩家的领土
    if (tile.ownerId !== currentPlayer.id) {
        showNotification('只能在自己的领土上招募单位！', 'error');
        return false;
    }
    
    // 检查格子上是否已经有单位
    if (tile.unit) {
        showNotification('该位置已经有单位！', 'error');
        return false;
    }
    
    // 获取单位信息
    const unitInfo = UNITS[unitType];
    const unitCost = unitInfo.cost;
    
    // 检查玩家是否有足够的金币
    if (currentPlayer.gold < unitCost) {
        showNotification('金币不足！', 'error');
        return false;
    }
    
    // 检查招募限制
    if (unitInfo.requiredBuildings) {
        // 处理需要多个建筑的情况 (如教官单位或油车)
        let requiredBuildings = [...unitInfo.requiredBuildings];
        
        // 词条：特殊征召 - 魔法兵无需魔法学院前置
        if (unitType === 'magicSoldier' && 
            currentPlayer.enchantments && 
            currentPlayer.enchantments.includes('specialRecruit')) {
            requiredBuildings = requiredBuildings.filter(b => b !== 'magicAcademy');
        }
        
        let hasAllRequiredBuildings = true;
        let missingBuildings = [];
        
        for (const buildingType of requiredBuildings) {
            let hasThisBuilding = false;
            
            for (let i = 0; i < gameState.map.length; i++) {
                const checkTile = gameState.map[i];
                if (checkTile.ownerId === currentPlayer.id && 
                    checkTile.building && 
                    checkTile.building.type === buildingType) {
                    hasThisBuilding = true;
                    break;
                }
            }
            
            if (!hasThisBuilding) {
                hasAllRequiredBuildings = false;
                missingBuildings.push(BUILDINGS[buildingType].name);
            }
        }
        
        if (!hasAllRequiredBuildings) {
            showNotification(`需要建造${missingBuildings.join('和')}才能招募该单位！`, 'error');
            return false;
        }
        
        // 对于油车的特殊处理（限制每回合只能招募一辆）
        if (unitType === 'oilCar') {
            // 检查玩家本回合是否已经招募过油车
            let oilCarRecruitedThisRound = false;
            for (let i = 0; i < gameState.map.length; i++) {
                const checkTile = gameState.map[i];
                if (checkTile.unit && 
                    checkTile.unit.type === 'oilCar' && 
                    checkTile.unit.ownerId === currentPlayer.id &&
                    checkTile.unit.recruitedThisTurn === gameState.turn) {
                    oilCarRecruitedThisRound = true;
                    break;
                }
            }
            
            if (oilCarRecruitedThisRound) {
                showNotification('每回合只能招募一辆油车！', 'error');
                return false;
            }
        }
    } else if (unitInfo.requiredBuilding) {
        // 处理传统的单一建筑要求
        const requiredBuilding = unitInfo.requiredBuilding;
        
        // 检查建筑招募限制
        if (requiredBuilding === 'barracks' && gameState.factoryProduction.barracksBuiltThisRound >= 1) {
            showNotification('每个军营每回合只能招募1个单位！', 'error');
            return false;
        } else if (requiredBuilding === 'armoryFactory' && gameState.factoryProduction.armoryFactoryBuiltThisRound >= 1) {
            showNotification('每个军事工厂每回合只能招募1个单位！', 'error');
            return false;
        } else if (requiredBuilding === 'bigArmoryFactory' && gameState.factoryProduction.bigArmoryFactoryBuiltThisRound >= 2) {
            showNotification('每个大型军事工厂每回合只能招募2个单位！', 'error');
            return false;
        }
        
        // 检查玩家是否拥有必要的建筑
        let hasRequiredBuilding = false;
        
        for (let i = 0; i < gameState.map.length; i++) {
            const checkTile = gameState.map[i];
            if (checkTile.ownerId === currentPlayer.id && 
                checkTile.building && 
                checkTile.building.type === requiredBuilding) {
                hasRequiredBuilding = true;
                break;
            }
        }
        
        if (!hasRequiredBuilding) {
            showNotification(`需要建造${BUILDINGS[requiredBuilding].name}才能招募该单位！`, 'error');
            return false;
        }
        
        // 增加对应建筑类型的招募计数
        if (requiredBuilding === 'barracks') {
            gameState.factoryProduction.barracksBuiltThisRound++;
        } else if (requiredBuilding === 'armoryFactory') {
            gameState.factoryProduction.armoryFactoryBuiltThisRound++;
        } else if (requiredBuilding === 'bigArmoryFactory') {
            gameState.factoryProduction.bigArmoryFactoryBuiltThisRound++;
        }
    }
    
    // 扣除金币
    currentPlayer.gold -= unitCost;
    
    // 创建单位
    tile.unit = {
        type: unitType,
        ownerId: currentPlayer.id,
        health: unitInfo.health,
        x: x,
        y: y,
        hasActed: true,  // 刚招募的单位本回合无法行动
        id: generateUnitId()
    };
    
    // 如果是教官单位，初始攻击力设为0
    if (unitType === 'instructor') {
        tile.unit.attack = 0;
    } else {
        tile.unit.attack = unitInfo.attack;
    }
    
    // 为油车单位添加标记当前回合招募
    if (unitType === 'oilCar') {
        tile.unit.recruitedThisTurn = gameState.turn;
    }
    
    // 添加到玩家单位列表
    currentPlayer.units.push(tile.unit);
    
    // 添加游戏日志
    addLogEntry(`${currentPlayer.name}在坐标(${x}, ${y})招募了${unitInfo.name}，花费${unitCost}金币。`);
    
    // 显示通知
    showNotification(`招募${unitInfo.name}成功！`);
    
    return true;
}

// 修理建筑
function repairBuilding(x, y) {
    const tileIndex = y * GRID_WIDTH + x;
    const tile = gameState.map[tileIndex];
    const player = gameState.players[gameState.currentPlayerIndex];
    
    // 检查是否是玩家的建筑
    if (tile.ownerId !== player.id || !tile.building) {
        showNotification('只能修理自己的建筑！', 'error');
        return false;
    }
    
    const targetBuilding = tile.building;
    
    // 检查建筑是否已满血
    const buildingType = targetBuilding.type;
    const maxHealth = buildingType === 'capital' ? BUILDINGS.capital.maxHealth : BUILDINGS[buildingType].maxHealth;
    
    if (targetBuilding.health >= maxHealth) {
        showNotification('该建筑已处于满健康状态！', 'info');
        return false;
    }
    
    // 计算修理费用 - 根据损失的健康值比例计算
    const healthPercentLost = 1 - (targetBuilding.health / maxHealth);
    // 为首都设置特殊的修理费用
    let repairCost;
    if (buildingType === "capital") {
        // 首都修理费用为损失健康值百分比 * 200
        repairCost = Math.ceil(200 * healthPercentLost);
    } else {
        // 其他建筑修理费用为建筑成本的20%乘以损失健康值百分比
        repairCost = Math.ceil(BUILDINGS[buildingType].cost * 0.2 * healthPercentLost);
    }
    
    if (player.gold < repairCost) {
        showNotification(`金币不足！修理需要${repairCost}金币。`, 'error');
        return false;
    }
    
    // 扣除金币
    player.gold -= repairCost;
    
    // 修复建筑
    const oldHealth = targetBuilding.health;
    targetBuilding.health = maxHealth;
    
    // 更新建筑损伤状态对收益的影响
    updateBuildingDamageEffect(tile, player);
    
    // 添加日志
    const buildingName = buildingType === 'capital' ? '首都' : BUILDINGS[buildingType].name;
    addLogEntry(`${player.name}花费${repairCost}金币修复了${buildingName}，健康值从${oldHealth}恢复到${maxHealth}。`);
    
    // 显示通知
    showNotification(`${buildingName}已修复！`, 'success');
    
    return true;
}

// 应用指挥单位光环效果
function applyCommandUnitEffect(unit, damage) {
    // 检查单位周围是否有指挥单位
    const x = unit.x;
    const y = unit.y;
    const ownerId = unit.ownerId;
    
    // 查看周围2格范围内是否有友方指挥单位
    for (let i = Math.max(0, x - 2); i <= Math.min(GRID_WIDTH - 1, x + 2); i++) {
        for (let j = Math.max(0, y - 2); j <= Math.min(GRID_HEIGHT - 1, y + 2); j++) {
            // 计算曼哈顿距离
            const distance = Math.abs(x - i) + Math.abs(y - j);
            if (distance <= 2) { // 在指挥单位的影响范围内
                const tileIndex = j * GRID_WIDTH + i;
                const tile = gameState.map[tileIndex];
                
                if (tile.unit && 
                    tile.unit.ownerId === ownerId && 
                    tile.unit.type === 'commandUnit') {
                    // 存在友方指挥单位，增加20%的伤害
                    damage = Math.floor(damage * 1.2);
                    break;
                }
            }
        }
    }
    
    return damage;
}

// 检查魔法学院光环效果
function applyMagicAcademyEffect(attacker, damage) {
    // 检查单位周围是否有魔法学院
    const x = attacker.x;
    const y = attacker.y;
    const ownerId = attacker.ownerId;
    
    // 查看周围2格范围内是否有魔法学院
    for (let i = Math.max(0, x - 2); i <= Math.min(GRID_WIDTH - 1, x + 2); i++) {
        for (let j = Math.max(0, y - 2); j <= Math.min(GRID_HEIGHT - 1, y + 2); j++) {
            // 计算曼哈顿距离
            const distance = Math.abs(x - i) + Math.abs(y - j);
            if (distance <= 2) { // 在魔法学院的影响范围内
                const tileIndex = j * GRID_WIDTH + i;
                const tile = gameState.map[tileIndex];
                
                if (tile.building && 
                    tile.building.type === 'magicAcademy' && 
                    tile.ownerId === ownerId) {
                    // 存在魔法学院，增加10%的伤害
                    damage = Math.floor(damage * 1.1);
                    break;
                }
            }
        }
    }
    
    return damage;
}

// 应用魔法buff
function applyMagicBuff(attacker, defender) {
    // 获取可用的buff
    const availableBuffs = UNITS.magicSoldier.magicBuffs;
    
    // 创建buff选择界面
    const buffSelectionModal = document.createElement('div');
    buffSelectionModal.style.position = 'fixed';
    buffSelectionModal.style.top = '0';
    buffSelectionModal.style.left = '0';
    buffSelectionModal.style.width = '100%';
    buffSelectionModal.style.height = '100%';
    buffSelectionModal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    buffSelectionModal.style.display = 'flex';
    buffSelectionModal.style.justifyContent = 'center';
    buffSelectionModal.style.alignItems = 'center';
    buffSelectionModal.style.zIndex = '1000';
    
    const buffContainer = document.createElement('div');
    buffContainer.style.backgroundColor = '#222';
    buffContainer.style.padding = '20px';
    buffContainer.style.borderRadius = '10px';
    buffContainer.style.color = '#fff';
    buffContainer.style.maxWidth = '500px';
    
    const title = document.createElement('h2');
    title.textContent = '选择魔法buff';
    title.style.marginBottom = '20px';
    title.style.textAlign = 'center';
    buffContainer.appendChild(title);
    
    const description = document.createElement('p');
    description.textContent = '魔法刀触发，选择一个buff效果：';
    description.style.marginBottom = '20px';
    buffContainer.appendChild(description);
    
    // 为每个buff创建选择按钮
    availableBuffs.forEach(buff => {
        const buffButton = document.createElement('div');
        buffButton.style.padding = '15px';
        buffButton.style.margin = '10px 0';
        buffButton.style.backgroundColor = '#333';
        buffButton.style.borderRadius = '5px';
        buffButton.style.cursor = 'pointer';
        buffButton.style.transition = 'background-color 0.2s';
        
        buffButton.innerHTML = `<strong>${buff.name}</strong><br>${buff.desc}`;
        
        // 鼠标悬停效果
        buffButton.addEventListener('mouseover', () => {
            buffButton.style.backgroundColor = '#444';
        });
        
        buffButton.addEventListener('mouseout', () => {
            buffButton.style.backgroundColor = '#333';
        });
        
        // 点击选择buff
        buffButton.addEventListener('click', () => {
            // 应用选择的buff
            if (buff.id === 'reflection') {
                attacker.reflectionBuff = true;
                addLogEntry(`${gameState.players[attacker.ownerId].name}的魔法兵获得了反伤buff！`);
            } else if (buff.id === 'armorBreak') {
                // 如果defender是建筑，则应用破甲效果
                if (defender.building) {
                    defender.armorBroken = true;
                    addLogEntry(`${gameState.players[attacker.ownerId].name}的魔法兵对${gameState.players[defender.ownerId].name}的建筑使用了破甲！`);
                } else {
                    // 如果不是建筑，则选择附近的建筑应用破甲
                    const nearbyBuilding = findNearbyEnemyBuilding(attacker, defender);
                    if (nearbyBuilding) {
                        nearbyBuilding.building.armorBroken = true;
                        addLogEntry(`${gameState.players[attacker.ownerId].name}的魔法兵对${gameState.players[nearbyBuilding.ownerId].name}的建筑使用了破甲！`);
                    }
                }
            }
            
            // 关闭选择界面
            document.body.removeChild(buffSelectionModal);
            
            // 更新UI
            updateGameStateDisplay();
            drawMap();
        });
        
        buffContainer.appendChild(buffButton);
    });
    
    buffSelectionModal.appendChild(buffContainer);
    document.body.appendChild(buffSelectionModal);
}

// 寻找附近的敌方建筑
function findNearbyEnemyBuilding(attacker, defender) {
    const x = defender.x || 0;
    const y = defender.y || 0;
    const range = 2; // 查找范围
    
    for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            // 确保在地图范围内
            if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                const tileIndex = ny * GRID_WIDTH + nx;
                const tile = gameState.map[tileIndex];
                
                // 检查是否有敌方建筑
                if (tile.building && tile.ownerId !== attacker.ownerId) {
                    return tile;
                }
            }
        }
    }
    
    return null;
} 