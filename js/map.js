// 地图相关功能

// 初始化地图
function initializeMap() {
    const map = [];
    
    // 创建网格
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            map.push({
                x: x,
                y: y,
                terrain: 'plain',
                ownerId: null,
                building: null,
                unit: null
            });
        }
    }
    
    return map;
}

// 生成随机地形（数量按地图大小比例缩放）
function generateRandomTerrain(map) {
    const totalTiles = GRID_WIDTH * GRID_HEIGHT;
    const scale = totalTiles / 300; // 300 = 旧的 20×15 基准
    
    const forestCount = Math.round(25 * scale);
    const mountainCount = Math.round(15 * scale);
    const waterCount = Math.round(10 * scale);
    
    // 森林：随机散布 + 簇状生成
    generateTerrainClusters(map, 'forest', forestCount, 0.4);
    
    // 山脉：簇状生成
    generateTerrainClusters(map, 'mountain', mountainCount, 0.5);
    
    // 水域：簇状生成（形成河流/湖泊感）
    generateTerrainClusters(map, 'water', waterCount, 0.6);
}

function generateTerrainClusters(map, terrainType, count, clusterChance) {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 5;
    
    while (placed < count && attempts < maxAttempts) {
        attempts++;
        let x, y;
        
        // 有一定概率在已有同类地形旁边生成（形成簇）
        if (placed > 0 && Math.random() < clusterChance) {
            const existing = [];
            for (let i = 0; i < map.length; i++) {
                if (map[i].terrain === terrainType) existing.push(map[i]);
            }
            if (existing.length > 0) {
                const base = existing[Math.floor(Math.random() * existing.length)];
                const dx = Math.floor(Math.random() * 3) - 1;
                const dy = Math.floor(Math.random() * 3) - 1;
                x = base.x + dx;
                y = base.y + dy;
            } else {
                x = Math.floor(Math.random() * GRID_WIDTH);
                y = Math.floor(Math.random() * GRID_HEIGHT);
            }
        } else {
            x = Math.floor(Math.random() * GRID_WIDTH);
            y = Math.floor(Math.random() * GRID_HEIGHT);
        }
        
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) continue;
        
        const idx = y * GRID_WIDTH + x;
        if (map[idx].ownerId === null && map[idx].terrain === 'plain') {
            map[idx].terrain = terrainType;
            placed++;
        }
    }
}

// 生成玩家起始区域
function generatePlayerStartingAreas(map, playerCount) {
    // 边距按地图大小动态计算，保证首都不贴边
    const marginX = Math.max(3, Math.floor(GRID_WIDTH * 0.1));
    const marginY = Math.max(3, Math.floor(GRID_HEIGHT * 0.1));
    
    const startingPositions = [
        { x: marginX, y: marginY },                                          // 左上
        { x: GRID_WIDTH - 1 - marginX, y: GRID_HEIGHT - 1 - marginY },     // 右下
        { x: GRID_WIDTH - 1 - marginX, y: marginY },                       // 右上
        { x: marginX, y: GRID_HEIGHT - 1 - marginY },                      // 左下
        { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) }  // 中心
    ].slice(0, playerCount);
    
    console.log("起始位置数量：", startingPositions.length);
    
    // 为每个玩家设置首都和占领区域
    for (let i = 0; i < playerCount; i++) {
        console.log(`设置玩家${i+1}的首都，位置：x=${startingPositions[i].x}, y=${startingPositions[i].y}`);
        const pos = startingPositions[i];
        const tileIndex = pos.y * GRID_WIDTH + pos.x;
        
        // 设置首都所在的格子
        map[tileIndex].ownerId = i;
        map[tileIndex].terrain = 'plain'; // 确保首都是在平原上
        map[tileIndex].building = {
            type: 'capital',
            name: BUILDINGS.capital.name,
            income: BUILDINGS.capital.income,
            health: BUILDINGS.capital.maxHealth,
            id: generateBuildingId()
        };
        
        // 占领周围的格子
        const radius = 2; // 占领半径
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = pos.x + dx;
                const ny = pos.y + dy;
                
                // 确保在地图范围内
                if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                    const neighborIndex = ny * GRID_WIDTH + nx;
                    
                    // 如果不是首都本身且没有其他建筑，则设为玩家领土
                    if (neighborIndex !== tileIndex && !map[neighborIndex].building) {
                        map[neighborIndex].ownerId = i;
                        
                        // 首都旁边的水变成平原
                        if (map[neighborIndex].terrain === 'water') {
                            map[neighborIndex].terrain = 'plain';
                        }
                    }
                }
            }
        }
    }
    
    console.log("玩家起始区域生成完成");
}

// 检查某个坐标是否在地图边界内
function isWithinMapBounds(x, y) {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

// 获取指定坐标的地图格子
function getTileAt(map, x, y) {
    if (!isWithinMapBounds(x, y)) return null;
    const tileIndex = y * GRID_WIDTH + x;
    return map[tileIndex];
}

// 获取指定坐标周围的格子
function getNeighborTiles(map, x, y, radius = 1) {
    const neighbors = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            // 跳过中心格子
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            
            // 确保在地图范围内
            if (isWithinMapBounds(nx, ny)) {
                const neighbor = getTileAt(map, nx, ny);
                neighbors.push(neighbor);
            }
        }
    }
    
    return neighbors;
}

// 计算两个格子之间的移动成本（考虑地形）
function calculateMovementCost(fromTile, toTile, unit) {
    // 如果是空中单位，忽略地形
    if (unit && unit.type === 'air') {
        return 1;
    }
    
    // 基于地形的移动成本
    const terrainCosts = {
        'plain': 1,
        'forest': 2,
        'mountain': 3,
        'water': Infinity  // 不可通行
    };
    
    return terrainCosts[toTile.terrain] || Infinity;
} 