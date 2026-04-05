// 建筑类型定义
const BUILDINGS = {
    // 基础建筑
    capital: {
        name: '首都',
        desc: '你的国家首都，提供基础收入。丢失首都将导致游戏失败。',
        combatNotes: '所有建筑享有25%的伤害减免。注意：被轰炸机和重型坦克攻击时伤害减免后还会有额外加成。',
        cost: 0,
        income: 50,
        maxHealth: 350,
        isUnique: true,
        buildTime: 0,
        category: 'basic'
    },
    farm: {
        name: '农场',
        desc: '提供基础收入。建造需要1回合。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 100,
        income: 20,
        maxHealth: 150,
        buildTime: 1,
        category: 'economy'
    },
    mine: {
        name: '矿场',
        desc: '提供更高收入，但建造成本更高。建造需要2回合。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 200,
        income: 35,
        maxHealth: 180,
        buildTime: 2,
        category: 'economy'
    },
    tradingPost: {
        name: '贸易站',
        desc: '提供高收入，但防御力较弱。建造需要2回合。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 300,
        income: 50,
        maxHealth: 130,
        buildTime: 2,
        category: 'economy'
    },
    bank: {
        name: '银行',
        desc: '提供非常高的收入，但建造成本高且防御力弱。建造需要3回合。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 500,
        income: 100,
        maxHealth: 120,
        buildTime: 3,
        category: 'economy'
    },
    
    // 军事建筑
    barracks: {
        name: '兵营',
        desc: '允许招募基础军事单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 150,
        income: -15,
        maxHealth: 200,
        buildTime: 2,
        category: 'military'
    },
    armoryFactory: {
        name: '军工厂',
        desc: '允许生产高级军事单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 300,
        income: -25,
        maxHealth: 180,
        buildTime: 3,
        category: 'military'
    },
    bigArmoryFactory: {
        name: '大型军工厂',
        desc: '允许生产最高级军事单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 500,
        income: -40,
        maxHealth: 200,
        buildTime: 4,
        category: 'military'
    },
    
    // 防御建筑
    tower: {
        name: '防御塔',
        desc: '增强防御能力，可自动攻击靠近的敌方单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 200,
        income: -10,
        attack: 30,
        attackRange: 2,
        maxHealth: 250,
        buildTime: 2,
        category: 'defense'
    },
    
    // 辅助建筑
    hospital: {
        name: '医院',
        desc: '每回合可以治疗附近一个受伤的单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 200,
        income: -20,
        maxHealth: 150,
        buildTime: 2,
        category: 'support'
    },
    bigHospital: {
        name: '大型医院',
        desc: '每回合可以治疗附近最多三个受伤的单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 400,
        income: -35,
        maxHealth: 180,
        buildTime: 3,
        category: 'support'
    },
    
    // 特殊建筑
    researchCenter: {
        name: '研究中心',
        desc: '解锁高级科技和单位升级。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 400,
        income: -30,
        maxHealth: 150,
        buildTime: 3,
        category: 'special',
        isUnique: true
    },
    library: {
        name: '图书馆',
        desc: '提供知识收益，与研究中心配合可招募教官单位。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 800,
        income: -15, // 实际收益是-25+10=-15
        knowledgeIncome: 10,
        maxHealth: 160,
        buildTime: 3,
        category: 'special',
        isUnique: true
    },
    oilCarFactory: {
        name: '油车厂',
        desc: '与研究中心配合可购买油车。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 800,
        income: -40,
        maxHealth: 200,
        buildTime: 4,
        category: 'special',
        isUnique: true
    },
    oilWell: {
        name: '油井',
        desc: '由油车占领敌方领地后有概率出现，提供收入。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 0, // 无法直接建造，只能通过油车占领获得
        income: 30,
        maxHealth: 160,
        buildTime: 0, // 立即建成
        category: 'economy',
        isUnique: false,
        cannotBuildDirectly: true // 标记此建筑无法直接建造
    },
    magicAcademy: {
        name: '魔法学院',
        desc: '由油车占领敌方领地后有极小概率出现，提供特殊能力。',
        combatNotes: '所有建筑享有25%的伤害减免。',
        cost: 0, // 无法直接建造，只能通过油车占领获得
        income: 50,
        maxHealth: 180,
        buildTime: 0, // 立即建成
        category: 'special',
        isUnique: true,
        cannotBuildDirectly: true, // 标记此建筑无法直接建造
        special: {
            name: '魔法加成',
            effect: '周围3格范围内的友方单位获得15%的攻击和防御加成'
        }
    }
};

// 建筑类别列表
const BUILDING_CATEGORIES = [
    { id: 'economy', name: '经济建筑' },
    { id: 'military', name: '军事建筑' },
    { id: 'defense', name: '防御建筑' },
    { id: 'support', name: '支援建筑' },
    { id: 'special', name: '特殊建筑' }
]; 