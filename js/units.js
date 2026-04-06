// 军事单位定义
const UNITS = {
    // 陆军单位
    infantry: {
        name: '步兵',
        desc: '基础地面单位，价格低廉但战斗力有限。',
        combatNotes: '对建筑造成的伤害会减少25%。',
        cost: 50,
        attack: 15,
        defense: 10,
        health: 100,
        moveRange: 2,
        attackRange: 1,
        buildTime: 1,
        type: 'ground',
        requiredBuilding: 'barracks'
    },
    tank: {
        name: '坦克',
        desc: '强力地面单位，适合攻击建筑和其他单位。',
        combatNotes: '对建筑造成的伤害会减少25%。',
        cost: 150,
        attack: 30,
        defense: 25,
        health: 150,
        moveRange: 3,
        attackRange: 1,
        buildTime: 2,
        type: 'ground',
        requiredBuilding: 'armoryFactory'
    },
    heavyTank: {
        name: '重型坦克',
        desc: '极其强力的地面单位，拥有高生命值和攻击力。',
        combatNotes: '对建筑造成的伤害提高50%，但仍受25%的建筑防御减免。',
        cost: 300,
        attack: 50,
        defense: 40,
        health: 200,
        moveRange: 2,
        attackRange: 1,
        buildTime: 3,
        type: 'ground',
        requiredBuilding: 'bigArmoryFactory'
    },
    
    // 空军单位
    helicopter: {
        name: '直升机',
        desc: '快速空中单位，可以无视地形移动。',
        combatNotes: '对建筑造成的伤害会减少25%。',
        cost: 200,
        attack: 35,
        defense: 15,
        health: 120,
        moveRange: 4,
        attackRange: 1,
        buildTime: 2,
        type: 'air',
        requiredBuilding: 'armoryFactory'
    },
    bomber: {
        name: '轰炸机',
        desc: '强力空中单位，可以对地面目标造成范围伤害。',
        combatNotes: '对建筑造成的伤害翻倍(×2)，但仍受25%的建筑防御减免。',
        cost: 350,
        attack: 60,
        defense: 20,
        health: 80,
        moveRange: 5,
        attackRange: 2,
        buildTime: 3,
        type: 'air',
        requiredBuilding: 'bigArmoryFactory'
    },
    
    // 远程单位
    artillery: {
        name: '火炮',
        desc: '远程攻击单位，可以从距离攻击敌方单位和建筑。',
        combatNotes: '对建筑造成的伤害会减少25%。',
        cost: 150,
        attack: 40,
        defense: 5,
        health: 80,
        moveRange: 1,
        attackRange: 3,
        buildTime: 2,
        type: 'ground',
        requiredBuilding: 'armoryFactory'
    },
    
    archer: {
        name: '弓箭手',
        desc: '远距离精准射手，造成目标25%生命值伤害。但每次攻击有50%概率对自身造成50%伤害。',
        combatNotes: '造成目标25%当前血量伤害。50%概率自身受到50%当前血量伤害。',
        cost: 500,
        attack: 30,
        defense: 10,
        health: 100,
        moveRange: 2,
        attackRange: 5,
        buildTime: 2,
        type: 'ground',
        requiredBuilding: 'barracks',
        special: {
            name: '精准射击',
            effect: '造成目标25%血量伤害，50%概率对自己造成50%血量伤害'
        },
        percentageDamage: true
    },
    
    // 特殊单位
    commandUnit: {
        name: '指挥单位',
        desc: '提升周围友方单位的战斗力。',
        combatNotes: '对建筑造成的伤害会减少25%。',
        cost: 250,
        attack: 20,
        defense: 30,
        health: 150,
        moveRange: 2,
        attackRange: 1,
        buildTime: 3,
        type: 'ground',
        requiredBuilding: 'researchCenter',
        special: {
            name: '指挥光环',
            effect: '提升周围2格友方单位20%的攻击力和防御力'
        }
    },
    instructor: {
        name: '教官',
        desc: '复制周围军事单位的一半攻击力，并能提供战术指导。',
        combatNotes: '对建筑造成的伤害会减少25%。攻击力取决于周围最多3个单位的一半攻击力总和。',
        cost: 700,
        attack: 0, // 基础攻击为0，实际攻击力取决于周围单位
        defense: 25,
        health: 140,
        moveRange: 3,
        attackRange: 1,
        buildTime: 3,
        type: 'ground',
        requiredBuildings: ['researchCenter', 'library'], // 需要同时拥有研究中心和图书馆
        special: {
            name: '战术指导',
            effect: '每回合可为多个相邻友方单位提供15%的临时攻击加成'
        },
        dynamicAttack: true // 标记此单位有动态攻击力
    },
    oilCar: {
        name: '油车',
        desc: '进入敌方领地后2回合，将占领此地且有机会出现特殊建筑。无法进入已有建筑的格子。',
        combatNotes: '对建筑造成的伤害会减少25%。',
        cost: 500,
        attack: 25,
        defense: 20,
        health: 60,
        moveRange: 3,
        attackRange: 1,
        buildTime: 2,
        type: 'ground',
        requiredBuildings: ['researchCenter', 'oilCarFactory'], // 需要同时拥有研究中心和油车厂
        special: {
            name: '领地占领',
            effect: '进入敌方领地2回合后，占领此地，且有60%概率出现油井，20%贸易站，10%什么都没有，9%出现银行，1%出现魔法学院'
        },
        canClaimTerritory: true, // 标记此单位可以占领领地
        claimCountdown: 2 // 需要等待的回合数
    },
    magicSoldier: {
        name: '魔法兵',
        desc: '强力魔法单位，拥有魔法刀和特殊能力。',
        combatNotes: '对建筑造成的伤害会减少25%。血量低于50%时，每回合扣除10%血量并增加100%攻击力。血量低于10%时有一次复活机会。',
        cost: 600,
        attack: 40,
        defense: 15,
        health: 110,
        moveRange: 2,
        attackRange: 1,
        buildTime: 3,
        type: 'special',
        requiredBuildings: ['researchCenter', 'library', 'magicAcademy'], // 需要同时拥有研究中心、图书馆和魔法学院
        special: {
            name: '魔法刀',
            effect: '有50%概率触发魔法刀，将攻击力翻倍并获得额外buff'
        },
        hasMagicAbility: true, // 标记拥有魔法能力
        magicBuffs: [
            { id: 'reflection', name: '反伤', desc: '当受到攻击时，反弹50%伤害给攻击者' },
            { id: 'armorBreak', name: '破甲', desc: '使目标建筑永久失去防御' }
        ]
    },
    pirate: {
        name: '海盗',
        desc: '从海盗船刷新的中立敌对单位，会自动寻找最近首都并沿途攻击所有单位和建筑。击杀可获得100金币。',
        combatNotes: '中立单位，主动移动并攻击路径上所有目标。击杀奖励100金币。',
        cost: 0,
        attack: 20,
        defense: 8,
        health: 70,
        moveRange: 2,
        attackRange: 1,
        buildTime: 0,
        type: 'ground',
        isNeutral: true,
        cannotRecruit: true,
        killReward: 100
    },
    bloodBerserker: {
        name: '嗜血狂魔',
        desc: '杀戮成长型单位。击杀军事单位+10生命+5攻击，摧毁建筑+10攻击+5生命。',
        combatNotes: '解锁条件：10回合内击杀5个军事单位。每次击杀/摧毁都会成长变强。',
        cost: 300,
        attack: 30,
        defense: 10,
        health: 50,
        moveRange: 2,
        attackRange: 1,
        buildTime: 0,
        type: 'special',
        requiredBuilding: 'barracks',
        special: {
            name: '嗜血成长',
            effect: '击杀军事单位：+10最大生命+5攻击力。摧毁建筑：+10攻击力+5最大生命。'
        },
        unlockCondition: { killUnits: 5, withinTurns: 10 },
        growthOnKillUnit: { maxHealth: 10, attack: 5 },
        growthOnDestroyBuilding: { attack: 10, maxHealth: 5 }
    }
};

// 单位类别列表
const UNIT_CATEGORIES = [
    { id: 'ground', name: '地面单位' },
    { id: 'air', name: '空中单位' },
    { id: 'special', name: '特殊单位' }
]; 