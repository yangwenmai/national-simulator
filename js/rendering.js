// 渲染相关功能
let canvas, ctx;
let mapViewMode = 'fit'; // 'fit' = 适应窗口, 'scroll' = 原始大小可拖拽
let _currentCellPx = 0;  // 当前每格像素尺寸，由 resizeCanvas 维护

// 初始化画布
function initCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    const scrollContainer = document.getElementById('canvas-scroll-container');
    
    // 初始化时就同步容器 CSS 状态，避免默认 overflow:auto 产生意外滚动条
    if (scrollContainer) {
        if (mapViewMode === 'fit') {
            scrollContainer.classList.add('fit-mode');
        } else {
            scrollContainer.classList.remove('fit-mode');
        }
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 拖拽滚动
    if (scrollContainer) {
        let isDragging = false, startX, startY, scrollLeft, scrollTop;
        
        scrollContainer.addEventListener('mousedown', (e) => {
            if (mapViewMode !== 'scroll') return;
            if (e.target !== canvas) return;
            isDragging = true;
            startX = e.pageX - scrollContainer.offsetLeft;
            startY = e.pageY - scrollContainer.offsetTop;
            scrollLeft = scrollContainer.scrollLeft;
            scrollTop = scrollContainer.scrollTop;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const moveX = e.pageX - scrollContainer.offsetLeft - startX;
            const moveY = e.pageY - scrollContainer.offsetTop - startY;
            scrollContainer.scrollLeft = scrollLeft - moveX;
            scrollContainer.scrollTop = scrollTop - moveY;
        });
        
        document.addEventListener('mouseup', () => { isDragging = false; });
    }
}

function setMapViewMode(mode) {
    mapViewMode = mode;
    
    const fitBtn = document.getElementById('view-fit-btn');
    const scrollBtn = document.getElementById('view-scroll-btn');
    
    if (fitBtn) fitBtn.className = mode === 'fit' ? 'active-view-btn' : '';
    if (scrollBtn) scrollBtn.className = mode === 'scroll' ? 'active-view-btn' : '';
    
    // 容器 class 和滚动位置由 resizeCanvas 统一管理，避免状态不同步
    resizeCanvas();
}

// 调整画布大小（保证每格恰好为整数像素，消除点击偏移）
function resizeCanvas() {
    const scrollContainer = document.getElementById('canvas-scroll-container');
    if (!scrollContainer) return;
    
    // ── 1. 同步容器 CSS 状态 ──
    // 始终在计算尺寸前同步，确保 clientWidth 读到的是正确布局
    if (mapViewMode === 'fit') {
        scrollContainer.classList.add('fit-mode');
        scrollContainer.scrollLeft = 0;
        scrollContainer.scrollTop = 0;
    } else {
        scrollContainer.classList.remove('fit-mode');
    }
    
    // ── 2. 强制浏览器完成布局后再读取容器宽度 ──
    const containerWidth = scrollContainer.clientWidth;
    let cellPx;
    
    if (mapViewMode === 'fit') {
        const maxH = window.innerHeight * 0.75;
        cellPx = Math.floor(containerWidth / GRID_WIDTH);
        if (cellPx * GRID_HEIGHT > maxH) {
            cellPx = Math.floor(maxH / GRID_HEIGHT);
        }
        cellPx = Math.max(2, cellPx);
    } else {
        cellPx = Math.max(MIN_CELL_PX, Math.floor(containerWidth / GRID_WIDTH));
    }
    
    // ── 3. 设置画布尺寸：bitmap 和 CSS 显示尺寸保持一致 ──
    const w = cellPx * GRID_WIDTH;
    const h = cellPx * GRID_HEIGHT;
    
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    
    // ── 4. 存储当前格子像素尺寸（供外部查询） ──
    _currentCellPx = cellPx;
    
    const info = document.getElementById('map-size-info');
    if (info) {
        info.textContent = `${GRID_WIDTH}×${GRID_HEIGHT} · 格子${cellPx}px`;
    }
    
    if (gameState && gameState.map && gameState.map.length > 0) {
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
    
    // 绘制高亮格子
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        if (tile.highlight) {
            const hx = tile.x * cellWidth;
            const hy = tile.y * cellHeight;
            ctx.fillStyle = tile.highlight.color;
            ctx.fillRect(hx, hy, cellWidth, cellHeight);
        }
    }
    
    // 绘制国家边界
    drawBorders(cellWidth, cellHeight);
    
    // 绘制格子内容（建筑、单位等）
    for (let i = 0; i < gameState.map.length; i++) {
        const tile = gameState.map[i];
        const x = tile.x * cellWidth;
        const y = tile.y * cellHeight;
        
        // 绘制建筑（城市非锚点部分跳过，由锚点统一绘制）
        if (tile.building) {
            if (tile.building.health === undefined) {
                if (tile.building.type === 'capital') {
                    tile.building.health = 350;
                } else if (BUILDINGS[tile.building.type]) {
                    tile.building.health = BUILDINGS[tile.building.type].maxHealth;
                } else {
                    tile.building.health = 200;
                }
            }
            
            if (tile.building.isCityPart) {
                // 城市非锚点部分不单独绘制
            } else {
                drawBuilding(tile, x, y, cellWidth, cellHeight);
            }
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
            let moveRange = UNITS[gameState.selectedUnit.type].moveRange;
            const moveOwner = gameState.players[gameState.selectedUnit.ownerId];
            if (moveOwner && moveOwner.enchantments && moveOwner.enchantments.includes('swiftMarch')) {
                moveRange += 1;
            }
            const srcX = gameState.selectedUnit.x;
            const srcY = gameState.selectedUnit.y;
            
            // 计算曼哈顿距离
            const distance = Math.abs(tile.x - srcX) + Math.abs(tile.y - srcY);
            
            if (distance <= moveRange && distance > 0) {
                ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
                ctx.fillRect(x, y, cellWidth, cellHeight);
            }
        }
        
        // 绘制攻击范围（医生为治疗范围）
        if (gameState.attackMode && gameState.selectedUnit) {
            const unitType = gameState.selectedUnit.type;
            const unitDef = UNITS[unitType];
            const range = unitDef.isHealer
                ? (unitDef.healRange != null ? unitDef.healRange : unitDef.attackRange)
                : unitDef.attackRange;
            const srcX = gameState.selectedUnit.x;
            const srcY = gameState.selectedUnit.y;
            
            const distance = Math.abs(tile.x - srcX) + Math.abs(tile.y - srcY);
            
            if (distance <= range && distance > 0) {
                const srcTileIndex = srcY * GRID_WIDTH + srcX;
                const srcTile = gameState.map[srcTileIndex];
                const attackerOwnerId = srcTile.unit.ownerId !== undefined ? srcTile.unit.ownerId : srcTile.ownerId;
                
                if (unitDef.isHealer) {
                    ctx.fillStyle = 'rgba(46, 204, 113, 0.22)';
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                    
                    if (tile.unit && window.isHealableFriendlyMilitaryUnit &&
                        window.isHealableFriendlyMilitaryUnit(tile.unit, attackerOwnerId)) {
                        const maxH = tile.unit.maxHealth || UNITS[tile.unit.type].health;
                        if (tile.unit.health < maxH) {
                            ctx.fillStyle = 'rgba(39, 174, 96, 0.5)';
                            ctx.fillRect(x, y, cellWidth, cellHeight);
                        }
                    }
                } else {
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                    
                    const enemyUnit = tile.unit && tile.unit.ownerId !== attackerOwnerId;
                    const bOwner = tile.building ? getTileBuildingOwnerId(tile) : null;
                    const enemyOrPirateShip = tile.building && (
                        tile.building.type === 'pirateShip' || bOwner !== attackerOwnerId
                    );
                    if (enemyUnit || (!tile.unit && enemyOrPirateShip)) {
                        ctx.fillStyle = 'rgba(231, 76, 60, 0.6)';
                        ctx.fillRect(x, y, cellWidth, cellHeight);
                    }
                }
            }
        }
    }
    
    // 绘制建造中的建筑
    if (gameState.buildingQueue && gameState.buildingQueue.length > 0) {
        gameState.buildingQueue.forEach(buildingProgress => {
            const x = buildingProgress.x * cellWidth;
            const y = buildingProgress.y * cellHeight;
            const isCity = buildingProgress.isCity;
            const areaWidth = isCity ? cellWidth * 2 : cellWidth;
            const areaHeight = isCity ? cellHeight * 2 : cellHeight;
            
            // 绘制建筑施工区域
            ctx.fillStyle = 'rgba(255, 235, 59, 0.3)';
            ctx.fillRect(x + 3, y + 3, areaWidth - 6, areaHeight - 6);
            
            // 施工中标志
            ctx.fillStyle = 'rgba(255, 152, 0, 0.6)';
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 5);
            ctx.lineTo(x + 25, y + 5);
            ctx.lineTo(x + 5, y + 25);
            ctx.fill();
            
            if (isCity) {
                // 城市施工中：绘制大的虚线框和"城"字
                ctx.strokeStyle = 'rgba(255, 152, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(x + 5, y + 5, areaWidth - 10, areaHeight - 10);
                ctx.setLineDash([]);
                
                ctx.fillStyle = 'rgba(170, 170, 170, 0.8)';
                ctx.font = `bold ${cellWidth * 0.4}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('城', x + areaWidth / 2, y + areaHeight / 2 - 10);
            } else {
                const buildingType = buildingProgress.type;
                drawBuildingInProgress(buildingType, x, y, cellWidth, cellHeight, buildingProgress.ownerId);
            }
            
            // 绘制建造进度条
            const progress = buildingProgress.progress;
            const progressBarHeight = 8;
            const progressBarWidth = areaWidth - 10;
            const progressBarY = y + areaHeight - progressBarHeight - 5;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(x + 5, progressBarY, progressBarWidth, progressBarHeight);
            
            ctx.fillStyle = gameState.players[buildingProgress.ownerId].color.main;
            ctx.fillRect(x + 5, progressBarY, progressBarWidth * (progress / 100), progressBarHeight);
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 5, progressBarY, progressBarWidth, progressBarHeight);
        });
    }
    
    // 绘制网格线（使用 0.5 像素偏移获得清晰的 1px 线条）
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= GRID_WIDTH; x++) {
        const px = Math.floor(x * cellWidth) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, GRID_HEIGHT * cellHeight);
        ctx.stroke();
    }
    
    for (let y = 0; y <= GRID_HEIGHT; y++) {
        const py = Math.floor(y * cellHeight) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(GRID_WIDTH * cellWidth, py);
        ctx.stroke();
    }
    
    // 绘制坐标标签（行号和列号）
    drawCoordinateLabels(cellWidth, cellHeight);
}

// 绘制坐标标签
function drawCoordinateLabels(cellWidth, cellHeight) {
    const fontSize = Math.max(7, Math.min(10, cellWidth * 0.3));
    ctx.save();
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 列号（顶部，每隔几列显示）
    const colStep = cellWidth < 18 ? 5 : (cellWidth < 28 ? 2 : 1);
    for (let x = 0; x < GRID_WIDTH; x += colStep) {
        ctx.fillText(x, x * cellWidth + cellWidth / 2, 1);
    }

    // 行号（左侧，每隔几行显示）
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const rowStep = cellHeight < 18 ? 5 : (cellHeight < 28 ? 2 : 1);
    for (let y = 0; y < GRID_HEIGHT; y += rowStep) {
        ctx.fillText(y, 2, y * cellHeight + cellHeight / 2);
    }

    ctx.restore();
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

            case 'missileFactory':
            // 导弹工厂
            ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
            ctx.fillRect(x + margin + 3, y + margin - 8, 5, 8);
            break;
        
            case 'repairShop':
                // 修理厂（扳手形状）
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + margin + 4, y + margin + buildingHeight - 4);
                ctx.lineTo(x + margin + buildingWidth - 4, y + margin + 4);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x + margin + buildingWidth - 4, y + margin + 4, 3, 0, Math.PI * 2);
                ctx.stroke();
                break;
            
            case 'territoryExpander':
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + margin + 2, y + margin + 2, buildingWidth - 4, buildingHeight - 4);
                ctx.beginPath();
                ctx.moveTo(x + margin + buildingWidth * 0.5, y + margin + 4);
                ctx.lineTo(x + margin + buildingWidth * 0.5, y + margin + buildingHeight - 4);
                ctx.moveTo(x + margin + 4, y + margin + buildingHeight * 0.5);
                ctx.lineTo(x + margin + buildingWidth - 4, y + margin + buildingHeight * 0.5);
                ctx.stroke();
                break;

            case 'pirateShip':
                // 海盗船（船体 + 桅杆 + 骷髅旗）
                ctx.fillStyle = '#5D4037';
                const boatY = y + margin + buildingHeight * 0.4;
                const boatH = buildingHeight * 0.5;
                ctx.beginPath();
                ctx.moveTo(x + margin, boatY + boatH);
                ctx.lineTo(x + margin + buildingWidth * 0.1, boatY);
                ctx.lineTo(x + margin + buildingWidth * 0.9, boatY);
                ctx.lineTo(x + margin + buildingWidth, boatY + boatH);
                ctx.closePath();
                ctx.fill();
                // 桅杆
                ctx.strokeStyle = '#3E2723';
                ctx.lineWidth = 2;
                const mastX = x + margin + buildingWidth * 0.5;
                ctx.beginPath();
                ctx.moveTo(mastX, boatY);
                ctx.lineTo(mastX, y + margin);
                ctx.stroke();
                // 骷髅旗
                ctx.fillStyle = '#333';
                ctx.fillRect(mastX, y + margin, buildingWidth * 0.35, buildingHeight * 0.25);
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(6, buildingWidth * 0.25)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('☠', mastX + buildingWidth * 0.17, y + margin + buildingHeight * 0.12);
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
    const displayOwnerId = getTileBuildingOwnerId(tile);
    
    if (displayOwnerId !== null && displayOwnerId >= 0) {
        ctx.fillStyle = gameState.players[displayOwnerId].color.main;
    } else {
        ctx.fillStyle = '#aaa';
    }
    
    // 绘制建筑图形
    const type = building.type;
    
    if (type === 'city' && building.isCityAnchor) {
        // 绘制城市（2x2跨格）
        const cityWidth = cellWidth * 2;
        const cityHeight = cellHeight * 2;
        const margin = cellWidth * 0.08;
        
        // 城市主体背景
        ctx.fillRect(x + margin, y + margin, cityWidth - margin * 2, cityHeight - margin * 2);
        
        // 城墙边框
        ctx.strokeStyle = tile.ownerId !== null ? gameState.players[tile.ownerId].color.dark : '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + margin, y + margin, cityWidth - margin * 2, cityHeight - margin * 2);
        
        // 城市内部建筑群
        const innerMargin = cellWidth * 0.2;
        ctx.fillStyle = tile.ownerId !== null ? gameState.players[tile.ownerId].color.dark : '#888';
        
        // 左上：塔楼
        ctx.fillRect(x + innerMargin, y + innerMargin, cellWidth * 0.4, cellHeight * 0.5);
        ctx.fillRect(x + innerMargin + cellWidth * 0.1, y + innerMargin - cellHeight * 0.1, cellWidth * 0.2, cellHeight * 0.1);
        
        // 右上：大厅
        ctx.fillRect(x + cellWidth + innerMargin * 0.5, y + innerMargin, cellWidth * 0.6, cellHeight * 0.6);
        
        // 左下：住宅
        ctx.fillRect(x + innerMargin, y + cellHeight + innerMargin * 0.3, cellWidth * 0.5, cellHeight * 0.4);
        
        // 右下：市场
        ctx.fillRect(x + cellWidth + innerMargin * 0.5, y + cellHeight + innerMargin * 0.3, cellWidth * 0.5, cellHeight * 0.4);
        
        // 中心广场
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + cellWidth * 0.7, y + cellHeight * 0.7, cellWidth * 0.6, cellHeight * 0.6);
        
        // 城市名称
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${cellWidth * 0.3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('城', x + cityWidth / 2, y + cityHeight / 2);
        
        // 绘制城市血条（跨2格宽度）
        const barWidth = cityWidth * 0.8;
        const barHeight = 6;
        const barX = x + (cityWidth - barWidth) / 2;
        const barY = y + cityHeight - 12;
        
        const maxHealth = BUILDINGS.city.maxHealth;
        const currentHealth = Math.max(0, building.health);
        const healthPercentage = Math.max(0, Math.min(1, currentHealth / maxHealth));
        
        ctx.fillStyle = '#ddd';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        if (healthPercentage > 0.7) ctx.fillStyle = '#4CAF50';
        else if (healthPercentage > 0.3) ctx.fillStyle = '#FFC107';
        else ctx.fillStyle = '#F44336';
        
        if (healthPercentage > 0) {
            ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
        }
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // 城市名称标签（绘制在左上角格子顶部）
        const cityLabelSize = Math.max(9, Math.min(12, cellWidth * 0.3));
        ctx.save();
        ctx.font = `bold ${cityLabelSize}px "Microsoft YaHei", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.strokeText('城市', x + cityWidth / 2, y + 3);
        ctx.fillStyle = '#fff';
        ctx.fillText('城市', x + cityWidth / 2, y + 3);
        ctx.restore();
        
        return; // 城市已绘制完毕，不需要后续的健康条绘制
    } else if (type === 'capital') {
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
                
            case 'missileFactory':
                // 导弹工厂
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                ctx.fillStyle = displayOwnerId !== null && displayOwnerId >= 0 ? gameState.players[displayOwnerId].color.dark : '#666';
                ctx.fillRect(x + margin + buildingWidth * 0.15, y + margin - buildingHeight * 0.2, buildingWidth * 0.15, buildingHeight * 0.2);
                ctx.fillRect(x + margin + buildingWidth * 0.65, y + margin - buildingHeight * 0.15, buildingWidth * 0.15, buildingHeight * 0.15);
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.moveTo(x + margin + buildingWidth * 0.5, y + margin + buildingHeight * 0.15);
                ctx.lineTo(x + margin + buildingWidth * 0.35, y + margin + buildingHeight * 0.7);
                ctx.lineTo(x + margin + buildingWidth * 0.65, y + margin + buildingHeight * 0.7);
                ctx.fill();
                break;
            
            case 'repairShop':
                // 修理厂
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + margin + buildingWidth * 0.2, y + margin + buildingHeight * 0.8);
                ctx.lineTo(x + margin + buildingWidth * 0.8, y + margin + buildingHeight * 0.2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x + margin + buildingWidth * 0.8, y + margin + buildingHeight * 0.2, buildingWidth * 0.12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#f39c12';
                ctx.font = `${Math.max(8, buildingWidth * 0.35)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('🔧', x + margin + buildingWidth / 2, y + margin + buildingHeight * 0.55);
                break;
            
            case 'territoryExpander': {
                ctx.save();
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                const cx = x + margin + buildingWidth / 2;
                const cy = y + margin + buildingHeight / 2;
                const r = buildingWidth * 0.28;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
                for (let i = 0; i < 4; i++) {
                    const ang = (i * Math.PI) / 2 - Math.PI / 4;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(ang) * r * 0.5, cy + Math.sin(ang) * r * 0.5);
                    ctx.lineTo(cx + Math.cos(ang) * r * 1.15, cy + Math.sin(ang) * r * 1.15);
                    ctx.stroke();
                }
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(7, buildingWidth * 0.22)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⊕', cx, cy);
                ctx.restore();
                break;
            }

            case 'pirateShip': {
                const shipBoatY = y + margin + buildingHeight * 0.4;
                const shipBoatH = buildingHeight * 0.5;
                ctx.fillStyle = '#5D4037';
                ctx.beginPath();
                ctx.moveTo(x + margin, shipBoatY + shipBoatH);
                ctx.lineTo(x + margin + buildingWidth * 0.1, shipBoatY);
                ctx.lineTo(x + margin + buildingWidth * 0.9, shipBoatY);
                ctx.lineTo(x + margin + buildingWidth, shipBoatY + shipBoatH);
                ctx.closePath();
                ctx.fill();
                const shipMastX = x + margin + buildingWidth * 0.5;
                ctx.strokeStyle = '#3E2723';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(shipMastX, shipBoatY);
                ctx.lineTo(shipMastX, y + margin);
                ctx.stroke();
                ctx.fillStyle = '#333';
                ctx.fillRect(shipMastX, y + margin, buildingWidth * 0.35, buildingHeight * 0.25);
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(6, buildingWidth * 0.25)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('☠', shipMastX + buildingWidth * 0.17, y + margin + buildingHeight * 0.12);
                break;
            }
                
            default:
                // 默认建筑样式
                ctx.fillRect(x + margin, y + margin, buildingWidth, buildingHeight);
        }
    }
    
    // 绘制健康值条
    drawHealthBar(x, y, cellWidth, cellHeight, building);
    
    // 绘制建筑名称标签
    drawBuildingLabel(type, x, y, cellWidth, cellHeight, displayOwnerId);
}

// 绘制单位
function drawUnit(tile, x, y, cellWidth, cellHeight) {
    const unit = tile.unit;
    
    // 设置颜色
    if (unit.ownerId !== null && unit.ownerId !== undefined && unit.ownerId >= 0 && gameState.players[unit.ownerId]) {
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
            
        case 'archer':
            // 绘制弓箭手（三角形+弓弦线）
            ctx.beginPath();
            ctx.moveTo(x + cellWidth / 2, y + margin);
            ctx.lineTo(x + margin, y + cellHeight - margin);
            ctx.lineTo(x + cellWidth - margin, y + cellHeight - margin);
            ctx.closePath();
            ctx.fill();
            // 弓弦
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + cellWidth * 0.35, y + cellHeight * 0.25);
            ctx.lineTo(x + cellWidth * 0.5, y + cellHeight * 0.55);
            ctx.lineTo(x + cellWidth * 0.65, y + cellHeight * 0.25);
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
        
        case 'doctor':
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            const cx = x + cellWidth / 2;
            const cy = y + cellHeight / 2;
            const arm = unitSize * 0.22;
            ctx.beginPath();
            ctx.moveTo(cx - arm, cy);
            ctx.lineTo(cx + arm, cy);
            ctx.moveTo(cx, cy - arm);
            ctx.lineTo(cx, cy + arm);
            ctx.stroke();
            break;
        
        case 'pirate':
            // 海盗（红色骷髅圆形）
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = `${Math.max(8, unitSize / 2.2)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('☠', x + cellWidth / 2, y + cellHeight / 2);
            break;
            
        case 'bloodBerserker': {
            const bRadius = unitSize / 2.2;
            // 外圈脉冲光晕（成长越多越亮）
            const kills = (unit.totalKills || 0) + (unit.totalDestroys || 0);
            const glowAlpha = Math.min(0.6, 0.15 + kills * 0.05);
            ctx.fillStyle = `rgba(200, 0, 0, ${glowAlpha})`;
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, bRadius + 3, 0, Math.PI * 2);
            ctx.fill();
            // 主体暗红色
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, bRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#4A0000';
            ctx.lineWidth = 2;
            ctx.stroke();
            // 中心交叉斧头标记
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            const cx2 = x + cellWidth / 2;
            const cy2 = y + cellHeight / 2;
            const half = bRadius * 0.5;
            ctx.beginPath();
            ctx.moveTo(cx2 - half, cy2 - half);
            ctx.lineTo(cx2 + half, cy2 + half);
            ctx.moveTo(cx2 + half, cy2 - half);
            ctx.lineTo(cx2 - half, cy2 + half);
            ctx.stroke();
            // 成长计数标记
            if (kills > 0) {
                ctx.fillStyle = '#FFD700';
                ctx.font = `bold ${Math.max(7, unitSize * 0.22)}px Arial`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(`×${kills}`, x + cellWidth - 2, y + 2);
            }
            break;
        }
            
        default:
            // 默认单位形状（圆形）
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, unitSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
    }
    
    // 绘制健康值条
    drawUnitHealthBar(x, y, cellWidth, cellHeight, unit);
    
    // 绘制单位名称标签
    drawUnitLabel(type, x, y, cellWidth, cellHeight, unit.ownerId);
    
    // 如果单位已经使用过，添加视觉指示
    if (unit.hasActed) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x + cellWidth / 2, y + cellHeight / 2, 5, 0, Math.PI * 2);
        ctx.fill();
    } else if (unit.hasMoved && !unit.hasAttacked) {
        // 有城市的玩家：已移动但未攻击 — 半透明标记
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(x + cellWidth / 2, y + cellHeight / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    } else if (unit.hasAttacked && !unit.hasMoved) {
        // 有城市的玩家：已攻击但未移动
        ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
        ctx.beginPath();
        ctx.arc(x + cellWidth / 2, y + cellHeight / 2, 4, 0, Math.PI * 2);
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
    const maxHealth = unit.maxHealth || UNITS[unit.type].health;
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

// 绘制建筑名称标签
function drawBuildingLabel(type, x, y, cellWidth, cellHeight, ownerId) {
    const bDef = BUILDINGS[type];
    if (!bDef) return;

    const label = bDef.name;
    const fontSize = Math.max(8, Math.min(11, cellWidth * 0.28));

    ctx.save();
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelX = x + cellWidth / 2;
    const labelY = y + 2;

    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, labelX, labelY);

    ctx.fillStyle = '#fff';
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
}

// 绘制单位名称标签
function drawUnitLabel(type, x, y, cellWidth, cellHeight, ownerId) {
    const uDef = UNITS[type];
    if (!uDef) return;

    const label = uDef.name;
    const fontSize = Math.max(7, Math.min(10, cellWidth * 0.24));

    ctx.save();
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelX = x + cellWidth / 2;
    const labelY = y + 1;

    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, labelX, labelY);

    ctx.fillStyle = '#fff';
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
}