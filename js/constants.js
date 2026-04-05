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

// 词条系统定义（需要魔法学院解锁）
const ENCHANTMENTS = {
    attackBoost: {
        id: 'attackBoost',
        name: '攻击强化',
        desc: '所有己方单位攻击力+20%',
        cost: 500,
        icon: '⚔️'
    },
    defenseBoost: {
        id: 'defenseBoost',
        name: '防御强化',
        desc: '所有己方单位防御力+20%',
        cost: 500,
        icon: '🛡️'
    },
    economicBoom: {
        id: 'economicBoom',
        name: '经济繁荣',
        desc: '所有经济建筑收入+25%',
        cost: 600,
        icon: '💰'
    },
    fastBuild: {
        id: 'fastBuild',
        name: '快速建造',
        desc: '新建筑建造时间减少1回合（最低1回合）',
        cost: 400,
        icon: '⚡'
    },
    specialRecruit: {
        id: 'specialRecruit',
        name: '特殊征召',
        desc: '无需魔法学院前置即可招募魔法兵（仍需研究中心和图书馆）',
        cost: 800,
        icon: '✨'
    },
    regeneration: {
        id: 'regeneration',
        name: '生命恢复',
        desc: '所有己方单位每回合恢复15点生命值',
        cost: 500,
        icon: '❤️'
    },
    territoryExpand: {
        id: 'territoryExpand',
        name: '领土扩张',
        desc: '建造建筑时领土扩展范围+1格',
        cost: 400,
        icon: '🗺️'
    },
    siegeMaster: {
        id: 'siegeMaster',
        name: '精准打击',
        desc: '对敌方建筑伤害额外+30%',
        cost: 600,
        icon: '🎯'
    },
    magicBarrier: {
        id: 'magicBarrier',
        name: '魔法屏障',
        desc: '所有己方建筑额外+15%伤害减免',
        cost: 700,
        icon: '🔮'
    }
}; 