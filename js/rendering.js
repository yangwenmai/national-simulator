// 渲染相关功能
let canvas, ctx;

// 初始化画布
function initCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 确保画布与容器大小匹配
    resizeCanvas();
    
    // 添加窗口调整大小事件监听
    window.addEventListener('resize', resizeCanvas);
}

// 调整画布大小
function resizeCanvas() {
    const container = document.getElementById('center-panel');
    const containerWidth = container.clientWidth;
    
    // 保持宽高比
    const ratio = GRID_HEIGHT / GRID_WIDTH;
    const height = containerWidth * ratio;
    
    canvas.width = containerWidth;
    canvas.height = height;
    
    // 重新绘制
    if (gameState) {
        drawMap();
    }
}

// 绘制地图
function drawMap() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 获取格子尺寸
    const cellWidth = canvas.width / GRID_WIDTH;
    const cellHeight = canvas.height / GRID_HEIGHT;
    
    // 绘制网格和地形
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        const x = tile.x * cellWidth;
        const y = tile.y * cellHeight;
        
        // 绘制地形底色
        switch(tile.terrain) {
            case 'plain':
                ctx.fillStyle = '#f8f8f8';
                break;
            case 'forest':
                ctx.fillStyle = '#c8e6c9';
                break;
            case 'mountain':
                ctx.fillStyle = '#d7ccc8';
                break;
            case 'water':
                ctx.fillStyle = '#bbdefb';
                break;
            default:
                ctx.fillStyle = '#f8f8f8';
        }
        
        // 绘制格子背景
        ctx.fillRect(x, y, cellWidth, cellHeight);
        
        // 绘制玩家领地颜色
        if (tile.ownerId !== null) {
            ctx.fillStyle = gameState.players[tile.ownerId].color.light;
            ctx.fillRect(x, y, cellWidth, cellHeight);
        }
    }
    
    // 绘制国家边界
    drawBorders(cellWidth, cellHeight);
    
    // 绘制格子内容（建筑、单位等）
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        const x = tile.x * cellWidth;
        const y = tile.y * cellHeight;
        
        // 绘制建筑
        if (tile.building) {
            // 如果建筑没有健康值，初始化一个默认值
            if (tile.building.health === undefined) {
                if (tile.building.type === 'capital') {
                    tile.building.health = 350; // 首都有350生命值
                } else if (BUILDINGS[tile.building.type]) {
                    tile.building.health = BUILDINGS[tile.building.type].maxHealth;
                } else {
                    tile.building.health = 200; // 默认健康值
                }
            }
            drawBuilding(tile, x, y, cellWidth, cellHeight);
        }
        
        // 绘制军事单位
        if (tile.unit) {
            drawUnit(tile, x, y, cellWidth, cellHeight);
        }
        
        // 绘制选中的格子高亮
        if (gameState.selectedTile && tile.x === gameState.selectedTile.x && tile.y === gameState.selectedTile.y) {
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
            ctx.lineWidth = 1;
        }
        
        // 绘制移动范围
        if (gameState.moveMode && gameState.selectedUnit) {
            const moveRange = UNITS[gameState.selectedUnit.type].moveRange;
            const srcX = gameState.selectedUnit.x;
            const srcY = gameState.selectedUnit.y;
            
            // 计算曼哈顿距离
            const distance = Math.abs(tile.x - srcX) + Math.abs(tile.y - srcY);
            
            if (distance <= moveRange && distance > 0) {
                ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
                ctx.fillRect(x, y, cellWidth, cellHeight);
            }
        }
        
        // 绘制攻击范围
        if (gameState.attackMode && gameState.selectedUnit) {
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            const unitType = gameState.selectedUnit.type;
            const attackRange = UNITS[unitType].attackRange;
            const srcX = gameState.selectedUnit.x;
            const srcY = gameState.selectedUnit.y;
            
            // 计算曼哈顿距离
            const distance = Math.abs(tile.x - srcX) + Math.abs(tile.y - srcY);
            
            // 在攻击范围内高亮显示
            if (distance <= attackRange && distance > 0) {
                ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                ctx.fillRect(x, y, cellWidth, cellHeight);
                
                // 敌方单位或建筑高亮显示
                const srcTileIndex = srcY * GRID_WIDTH + srcX;
                const srcTile = gameState.map[srcTileIndex];
                const attackerOwnerId = srcTile.unit.ownerId !== undefined ? srcTile.unit.ownerId : srcTile.ownerId;
                
                if ((tile.unit && tile.unit.ownerId !== attackerOwnerId) || 
                    (!tile.unit && tile.building && tile.ownerId !== attackerOwnerId)) {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.6)';
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                }
            }
        }
    }
    
    // 绘制建造中的建筑
    if (gameState.buildingQueue && gameState.buildingQueue.length > 0) {
        gameState.buildingQueue.forEach(buildingProgress => {
            const x = buildingProgress.x * cellWidth;
            const y = buildingProgress.y * cellHeight;
            
            // 绘制建筑施工区域
            ctx.fillStyle = 'rgba(255, 235, 59, 0.3)'; // 黄色半透明
            ctx.fillRect(x + 5, y + 5, cellWidth - 10, cellHeight - 10);
            
            // 添加明显的"施工中"标志
            ctx.fillStyle = 'rgba(255, 152, 0, 0.6)'; // 橙色半透明
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 5);
            ctx.lineTo(x + 25, y + 5);
            ctx.lineTo(x + 5, y + 25);
            ctx.fill();
            
            // 显示建筑图标 - 灰色的建筑形状
            const buildingType = buildingProgress.type;
            drawBuildingInProgress(buildingType, x, y, cellWidth, cellHeight, buildingProgress.ownerId);
            
            // 绘制建造进度条
            const progress = buildingProgress.progress;
            const progressBarHeight = 8;
            const progressBarWidth = cellWidth - 10;
            const progressBarY = y + cellHeight - progressBarHeight - 5;
            
            // 进度条背景
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(x + 5, progressBarY, progressBarWidth, progressBarHeight);
            
            // 进度条填充
            ctx.fillStyle = gameState.players[buildingProgress.ownerId].color.main;
            ctx.fillRect(x + 5, progressBarY, progressBarWidth * (progress / 100), progressBarHeight);
            
            // 进度条边框
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 5, progressBarY, progressBarWidth, progressBarHeight);
        });
    }
    
    // 绘制网格线
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth, 0);
        ctx.lineTo(x * cellWidth, GRID_HEIGHT * cellHeight);
        ctx.stroke();
    }
    
    for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellHeight);
        ctx.lineTo(GRID_WIDTH * cellWidth, y * cellHeight);
        ctx.stroke();
    }
}

// 绘制正在建造中的建筑
function drawBuildingInProgress(buildingType, x, y, cellWidth, cellHeight, ownerId) {
    const margin = cellWidth * 0.2;
    const buildingWidth = cellWidth * 0.6;
    const buildingHeight = cellHeight * 0.6;
    
    // 使用玩家颜色但降低透明度
    ctx.fillStyle = 'rgba(170, 170, 170, 0.8)';
    
    // 使用基本形状表示不同建筑类型
    switch(buildingType) {
        case 'farm':
            // 简单农场轮廓
            ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
            break;
            
        case 'mine':
            // 简单矿场轮廓
            ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
            // 矿洞入口指示
            ctx.beginPath();
            ctx.arc(x + margin + buildingWidth / 2, y + margin + buildingHeight / 2, buildingWidth / 4, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
        case 'tradingPost':
            // 简单贸易站轮廓
            ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
            // 屋顶指示
            ctx.beginPath();
            ctx.moveTo(x + margin, y + margin);
            ctx.lineTo(x + margin + buildingWidth / 2, y + margin - 5);
            ctx.lineTo(x + margin + buildingWidth, y + margin);
            ctx.stroke();
            break;
            
        case 'bank':
            // 银行基本形状
            ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
            // 添加列柱指示
            ctx.strokeRect(x + margin + 5, y + margin, 5, buildingHeight);
            ctx.strokeRect(x + margin + buildingWidth - 10, y + margin, 5, buildingHeight);
            break;
        
        default:
            // 默认简单矩形
            ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
    }
    
    // 添加施工标志 - 小小的起重机图标或者工具
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    // 简单的工具图标
    ctx.moveTo(x + cellWidth * 0.7, y + cellHeight * 0.3);
    ctx.lineTo(x + cellWidth * 0.8, y + cellHeight * 0.4);
    ctx.stroke();
}

// 绘制国家边界
function drawBorders(cellWidth, cellHeight) {
    // 遍历每个格子
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const tileIndex = y * GRID_WIDTH + x;
            const tile = gameState.map[tileIndex];
            
            // 只处理有所有者的格子
            if (tile.ownerId !== null) {
                const tileX = x * cellWidth;
                const tileY = y * cellHeight;
                
                // 检查四个方向的相邻格子
                const directions = [
                    { dx: -1, dy: 0, side: 'left' },
                    { dx: 1, dy: 0, side: 'right' },
                    { dx: 0, dy: -1, side: 'top' },
                    { dx: 0, dy: 1, side: 'bottom' }
                ];
                
                directions.forEach(dir => {
                    const nx = x + dir.dx;
                    const ny = y + dir.dy;
                    
                    // 检查是否在地图边界内
                    if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                        const neighborIndex = ny * GRID_WIDTH + nx;
                        const neighbor = gameState.map[neighborIndex];
                        
                        // 如果相邻格子属于不同玩家或无所有者，绘制边界
                        if (neighbor.ownerId !== tile.ownerId) {
                            drawBorderLine(tileX, tileY, dir.side, cellWidth, cellHeight);
                        }
                    } else {
                        // 如果在地图边缘，也绘制边界
                        drawBorderLine(tileX, tileY, dir.side, cellWidth, cellHeight);
                    }
                });
            }
        }
    }
}

// 绘制边界线
function drawBorderLine(x, y, side, cellWidth, cellHeight) {
    ctx.beginPath();
    ctx.lineWidth = 3;
    
    // 使用玩家的边界颜色
    const tile = getTileByCoordinates(x / cellWidth, y / cellHeight);
    if (tile && tile.ownerId !== null) {
        ctx.strokeStyle = gameState.players[tile.ownerId].color.dark;
    } else {
        ctx.strokeStyle = '#888';
    }
    
    switch(side) {
        case 'left':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + cellHeight);
            break;
        case 'right':
            ctx.moveTo(x + cellWidth, y);
            ctx.lineTo(x + cellWidth, y + cellHeight);
            break;
        case 'top':
            ctx.moveTo(x, y);
            ctx.lineTo(x + cellWidth, y);
            break;
        case 'bottom':
            ctx.moveTo(x, y + cellHeight);
            ctx.lineTo(x + cellWidth, y + cellHeight);
            break;
    }
    
    ctx.stroke();
}

// 通过坐标获取地图格子
function getTileByCoordinates(x, y) {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    
    if (tileX < 0 || tileX >= GRID_WIDTH || tileY < 0 || tileY >= GRID_HEIGHT) {
        return null;
    }
    
    const tileIndex = tileY * GRID_WIDTH + tileX;
    return gameState.map[tileIndex];
}

// 绘制建筑
function drawBuilding(tile, x, y, cellWidth, cellHeight) {
    const building = tile.building;
    
    // 设置颜色
    if (tile.ownerId !== null) {
        ctx.fillStyle = gameState.players[tile.ownerId].color.main;
    } else {
        ctx.fillStyle = '#aaa';
    }
    
    // 绘制建筑图形
    const type = building.type;
    
    if (type === 'capital') {
        // 绘制首都（城堡）
        const margin = cellWidth * 0.1;
        const buildingWidth = cellWidth * 0.8;
        const buildingHeight = cellHeight * 0.8;
        
        // 城堡主体
        ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
        
        // 城堡塔楼
        ctx.fillRect(x + margin, y + margin - 5, cellWidth * 0.15, 5);
        ctx.fillRect(x + margin + buildingWidth * 0.42, y + margin - 7, cellWidth * 0.15, 7);
        ctx.fillRect(x + margin + buildingWidth - cellWidth * 0.15, y + margin - 5, cellWidth * 0.15, 5);
        
        // 城堡门
        ctx.fillStyle = '#333';
        ctx.fillRect(x + margin + buildingWidth * 0.4, y + margin + buildingHeight * 0.6, buildingWidth * 0.2, buildingHeight * 0.4);
    } else {
        // 绘制其他建筑
        const margin = cellWidth * 0.2;
        const buildingWidth = cellWidth * 0.6;
        const buildingHeight = cellHeight * 0.6;
        
        // 根据建筑类型绘制不同形状
        switch(type) {
            case 'farm':
                // 绘制农场
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                // 绘制十字图案
                ctx.fillStyle = '#4CAF50';
                ctx.fillRect(x + margin + buildingWidth * 0.4, y + margin, buildingWidth * 0.2, buildingHeight);
                ctx.fillRect(x + margin, y + margin + buildingHeight * 0.4, buildingWidth, buildingHeight * 0.2);
                break;
                
            case 'mine':
                // 绘制矿场
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                // 绘制矿洞入口
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(x + margin + buildingWidth / 2, y + margin + buildingHeight / 2, buildingWidth / 4, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'tradingPost':
                // 绘制贸易站
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                // 绘制屋顶
                ctx.beginPath();
                ctx.moveTo(x + margin, y + margin);
                ctx.lineTo(x + margin + buildingWidth / 2, y + margin - 10);
                ctx.lineTo(x + margin + buildingWidth, y + margin);
                ctx.fill();
                break;
                
            case 'barracks':
                // 绘制兵营
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                // 绘制旗帜
                ctx.fillStyle = '#fff';
                ctx.fillRect(x + margin + buildingWidth / 2, y + margin - 10, 2, 15);
                ctx.fillStyle = '#f44336';
                ctx.beginPath();
                ctx.moveTo(x + margin + buildingWidth / 2 + 2, y + margin - 10);
                ctx.lineTo(x + margin + buildingWidth / 2 + 10, y + margin - 7);
                ctx.lineTo(x + margin + buildingWidth / 2 + 2, y + margin - 4);
                ctx.fill();
                break;
                
            default:
                // 默认建筑样式
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
        }
    }
    
    // 绘制健康值条
    drawHealthBar(x, y, cellWidth, cellHeight, building);
}

// 绘制单位
function drawUnit(tile, x, y, cellWidth, cellHeight) {
    const unit = tile.unit;
    
    // 设置颜色
    if (unit.ownerId !== null && unit.ownerId !== undefined) {
        ctx.fillStyle = gameState.players[unit.ownerId].color.main;
    } else {
        ctx.fillStyle = '#aaa';
    }
    
    // 绘制单位图形
    const type = unit.type;
    const margin = cellWidth * 0.15;
    const unitSize = cellWidth * 0.7;
    
    // 根据单位类型绘制不同形状
    switch(type) {
        case 'infantry':
            // 绘制步兵（圆形）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
            break;
            
        case 'tank':
            // 绘制坦克（矩形带三角形炮塔）
            ctx.fillRect(x + margin, y + margin + unitSize * 0.25, unitSize, unitSize * 0.5);
            ctx.beginPath();
            ctx.moveTo(x + margin + unitSize * 0.5, y + margin + unitSize * 0.25);
            ctx.lineTo(x + margin + unitSize * 0.8, y + margin);
            ctx.lineTo(x + margin + unitSize, y + margin + unitSize * 0.25);
            ctx.fill();
            break;
            
        case 'heavyTank':
            // 绘制重型坦克（大矩形带三角形炮塔）
            ctx.fillRect(x + margin * 0.8, y + margin + unitSize * 0.25, unitSize * 1.2, unitSize * 0.5);
            ctx.beginPath();
            ctx.moveTo(x + margin * 0.8 + unitSize * 0.6, y + margin + unitSize * 0.25);
            ctx.lineTo(x + margin * 0.8 + unitSize * 0.9, y + margin * 0.5);
            ctx.lineTo(x + margin * 0.8 + unitSize * 1.2, y + margin + unitSize * 0.25);
            ctx.fill();
            break;
            
        case 'helicopter':
            // 绘制直升机（一个圆形和一条线）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 3, 0, Math.PI * 2);
            ctx.fill();
            
            // 旋翼
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + cellWidth / 2 - unitSize / 2, y + cellHeight / 2);
            ctx.lineTo(x + cellWidth / 2 + unitSize / 2, y + cellHeight / 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + cellWidth / 2, y + cellHeight / 2 - unitSize / 2);
            ctx.lineTo(x + cellWidth / 2, y + cellHeight / 2 + unitSize / 2);
            ctx.stroke();
            break;
            
        case 'artillery':
            // 绘制火炮（圆形带长线炮管）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2 + unitSize / 6, unitSize / 3, 0, Math.PI * 2);
            ctx.fill();
            
            // 炮管
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + cellWidth / 2, y + cellHeight / 2);
            ctx.lineTo(x + cellWidth / 2, y + cellHeight / 2 - unitSize / 2);
            ctx.stroke();
            break;
            
        case 'commandUnit':
            // 绘制指挥单位（带星号的圆形）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制星号
            ctx.fillStyle = '#fff';
            ctx.font = `${unitSize / 2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', x + cellWidth / 2, y + cellHeight / 2);
            break;
            
        case 'instructor':
            // 绘制教官单位（带书本形状的圆形）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制简易书本符号
            ctx.fillStyle = '#fff';
            ctx.font = `${unitSize / 2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📚', x + cellWidth / 2, y + cellHeight / 2);
            break;
            
        default:
            // 默认单位形状（圆形）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
    }
    
    // 绘制健康值条
    drawUnitHealthBar(x, y, cellWidth, cellHeight, unit);
    
    // 如果单位已经使用过，添加一个视觉指示
    if (unit.hasActed) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x + cellWidth / 2, y + cellHeight / 2, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 如果单位有战术指导加成，绘制一个特殊标记
    if (unit.tacticalGuidanceBoost) {
        ctx.fillStyle = 'rgba(39, 174, 96, 0.8)'; // 绿色
        ctx.beginPath();
        ctx.arc(x + cellWidth / 2 + unitSize / 2, y + cellHeight / 2 - unitSize / 2, unitSize / 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制一个+号
        ctx.fillStyle = 'white';
        ctx.font = `bold ${unitSize / 3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', x + cellWidth / 2 + unitSize / 2, y + cellHeight / 2 - unitSize / 2);
    }
}

// 绘制建筑健康值条
function drawHealthBar(x, y, cellWidth, cellHeight, entity) {
    // 确定生命值上限
    let maxHealth;
    if (entity.type === 'capital') {
        maxHealth = BUILDINGS.capital.maxHealth;
    } else if (BUILDINGS[entity.type]) {
        maxHealth = BUILDINGS[entity.type].maxHealth;
    } else {
        maxHealth = 200; // 默认健康值
    }
    
    // 确保健康值不为负数
    const currentHealth = Math.max(0, entity.health);
    const healthPercentage = Math.max(0, Math.min(1, currentHealth / maxHealth));
    
    // 设置健康值条位置和大小
    const barWidth = cellWidth * 0.8;
    const barHeight = 5;
    const barX = x + (cellWidth - barWidth) / 2;
    const barY = y + cellHeight - 10;
    
    // 绘制背景
    ctx.fillStyle = '#ddd';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 根据健康状况绘制不同颜色
    if (healthPercentage > 0.7) {
        ctx.fillStyle = '#4CAF50'; // 绿色 - 健康
    } else if (healthPercentage > 0.3) {
        ctx.fillStyle = '#FFC107'; // 黄色 - 受损
    } else if (healthPercentage > 0) {
        ctx.fillStyle = '#F44336'; // 红色 - 严重受损
    } else {
        // 不绘制血条，因为健康值为0
        ctx.fillStyle = 'transparent';
    }
    
    // 绘制当前健康值
    if (healthPercentage > 0) {
        ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
    }
    
    // 添加边框
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
}

// 绘制单位健康值条
function drawUnitHealthBar(x, y, cellWidth, cellHeight, unit) {
    const maxHealth = UNITS[unit.type].health;
    // 确保健康值不为负数或NaN
    const currentHealth = Math.max(0, isNaN(unit.health) ? 0 : unit.health);
    const healthPercentage = Math.max(0, Math.min(1, currentHealth / maxHealth));
    
    // 设置健康值条位置和大小
    const barWidth = cellWidth * 0.6;
    const barHeight = 3;
    const barX = x + (cellWidth - barWidth) / 2;
    const barY = y + cellHeight - 8;
    
    // 绘制背景
    ctx.fillStyle = '#ddd';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 根据健康状况绘制不同颜色
    if (healthPercentage > 0.7) {
        ctx.fillStyle = '#4CAF50'; // 绿色 - 健康
    } else if (healthPercentage > 0.3) {
        ctx.fillStyle = '#FFC107'; // 黄色 - 受损
    } else if (healthPercentage > 0) {
        ctx.fillStyle = '#F44336'; // 红色 - 严重受损
    } else {
        // 不绘制血条，因为健康值为0
        ctx.fillStyle = 'transparent';
    }
    
    // 绘制当前健康值
    if (healthPercentage > 0) {
        ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
    }
    
    // 添加边框
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
} 