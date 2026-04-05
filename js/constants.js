// 游戏常量定义
const GRID_WIDTH = 20;           // 地图宽度（格子数）
const GRID_HEIGHT = 15;          // 地图高度（格子数）
const GRID_SIZE = 40;            // 格子大小（像素）

// 最大玩家数量
const MAX_PLAYERS = 5;

// 游戏颜色定义
const PLAYER_COLORS = [
    { main: '#3498db', dark: '#2980b9', light: 'rgba(52, 152, 219, 0.3)' },   // 蓝色
    { main: '#e74c3c', dark: '#c0392b', light: 'rgba(231, 76, 60, 0.3)' },    // 红色
    { main: '#2ecc71', dark: '#27ae60', light: 'rgba(46, 204, 113, 0.3)' },   // 绿色
    { main: '#f1c40f', dark: '#f39c12', light: 'rgba(241, 196, 15, 0.3)' },   // 黄色
    { main: '#9b59b6', dark: '#8e44ad', light: 'rgba(155, 89, 182, 0.3)' }    // 紫色
];

// 初始金币数量
const INITIAL_GOLD = 400;

// 通知类型
const NOTIFICATION_TYPES = {
    error: { color: '#e74c3c', duration: 3000 },
    success: { color: '#2ecc71', duration: 2000 },
    info: { color: '#3498db', duration: 2500 },
    warning: { color: '#f39c12', duration: 2500 }
};

// 游戏阶段类型
const GAME_PHASES = {
    PLANNING: 'planning',
    EXECUTION: 'execution',
    END: 'end'
}; 