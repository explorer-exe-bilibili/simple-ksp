// 任务系统
class Mission {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.name = options.name || 'Unknown Mission';
        this.description = options.description || '';
        this.difficulty = options.difficulty || 'easy'; // easy, medium, hard, extreme
        
        // 任务目标
        this.objectives = options.objectives || [];
        this.completedObjectives = [];
        
        // 奖励
        this.rewards = options.rewards || {
            funds: 0,
            science: 0,
            reputation: 0
        };
        
        // 状态
        this.status = 'available'; // available, active, completed, failed
        this.startTime = null;
        this.completeTime = null;
        
        // 需求
        this.requirements = options.requirements || {};
        
        // 时间限制
        this.timeLimit = options.timeLimit || null; // 秒数，null表示无限制
        
        // 任务类型
        this.type = options.type || 'general'; // general, exploration, rescue, satellite, etc.
        
        // 目标天体
        this.targetBody = options.targetBody || 'Kerbin';
        
        this.bindMethods();
    }
    
    generateId() {
        return 'mission_' + Math.random().toString(36).substr(2, 9);
    }
    
    bindMethods() {
        this.checkObjectives = this.checkObjectives.bind(this);
    }
    
    // 开始任务
    start() {
        if (this.status === 'available' && this.checkRequirements()) {
            this.status = 'active';
            this.startTime = Date.now();
            
            // 重置目标状态
            this.completedObjectives = [];
            
            console.log(`任务开始: ${this.name}`);
            return true;
        }
        return false;
    }
    
    // 检查需求
    checkRequirements() {
        // 检查资金需求
        if (this.requirements.funds && gameEngine) {
            // TODO: 检查玩家资金
        }
        
        // 检查科技需求
        if (this.requirements.tech && gameEngine) {
            // TODO: 检查已解锁的科技
        }
        
        // 检查其他需求
        return true;
    }
    
    // 更新任务状态
    update(gameState) {
        if (this.status !== 'active') return;
        
        // 检查时间限制
        if (this.timeLimit && this.startTime) {
            const elapsedTime = (Date.now() - this.startTime) / 1000;
            if (elapsedTime > this.timeLimit) {
                this.fail('时间超限');
                return;
            }
        }
        
        // 检查目标完成情况
        this.checkObjectives(gameState);
        
        // 检查任务是否完成
        if (this.completedObjectives.length === this.objectives.length) {
            this.complete();
        }
    }
    
    // 检查目标
    checkObjectives(gameState) {
        this.objectives.forEach((objective, index) => {
            if (!this.completedObjectives.includes(index)) {
                if (this.checkObjective(objective, gameState)) {
                    this.completeObjective(index);
                }
            }
        });
    }
    
    // 检查单个目标
    checkObjective(objective, gameState) {
        const vehicle = gameState.currentVehicle;
        if (!vehicle) return false;
        
        switch (objective.type) {
            case 'reach_altitude':
                return vehicle.altitude >= objective.altitude;
                
            case 'reach_speed':
                return vehicle.velocity >= objective.speed;
                
            case 'orbit':
                return this.checkOrbitObjective(objective, vehicle);
                
            case 'land':
                return this.checkLandingObjective(objective, vehicle);
                
            case 'dock':
                return this.checkDockingObjective(objective, vehicle);
                
            case 'crew_report':
                return this.checkCrewReportObjective(objective, vehicle);
                
            case 'science_experiment':
                return this.checkScienceObjective(objective, vehicle);
                
            case 'collect_sample':
                return this.checkSampleObjective(objective, vehicle);
                
            case 'plant_flag':
                return this.checkFlagObjective(objective, vehicle);
                
            case 'return_home':
                return this.checkReturnObjective(objective, vehicle);
                
            default:
                return false;
        }
    }
    
    checkOrbitObjective(objective, vehicle) {
        if (!vehicle.orbitInfo) return false;
        
        const orbit = vehicle.orbitInfo;
        const altitude = vehicle.altitude;
        
        // 检查是否在轨道上
        const minAltitude = objective.minAltitude || 70000; // 最低轨道高度
        const maxAltitude = objective.maxAltitude || 2000000; // 最高轨道高度
        
        return altitude > minAltitude && 
               (orbit.apoapsis < maxAltitude || objective.maxAltitude === undefined) &&
               orbit.eccentricity < (objective.maxEccentricity || 1);
    }
    
    checkLandingObjective(objective, vehicle) {
        // 检查是否着陆
        const targetBody = objective.body || 'Kerbin';
        const landingZone = objective.zone; // 可选的着陆区域
        
        // 简化检查：高度接近0且速度很低
        return vehicle.altitude < 100 && vehicle.velocity < 5;
    }
    
    checkDockingObjective(objective, vehicle) {
        // TODO: 实现对接检查
        return false;
    }
    
    checkCrewReportObjective(objective, vehicle) {
        // TODO: 实现乘员报告检查
        return false;
    }
    
    checkScienceObjective(objective, vehicle) {
        // TODO: 实现科学实验检查
        return false;
    }
    
    checkSampleObjective(objective, vehicle) {
        // TODO: 实现样本收集检查
        return false;
    }
    
    checkFlagObjective(objective, vehicle) {
        // TODO: 实现旗帜种植检查
        return false;
    }
    
    checkReturnObjective(objective, vehicle) {
        const targetBody = objective.body || 'Kerbin';
        
        // 检查是否返回指定天体
        return vehicle.altitude < 1000 && vehicle.velocity < 10; // 简化检查
    }
    
    // 完成目标
    completeObjective(objectiveIndex) {
        if (!this.completedObjectives.includes(objectiveIndex)) {
            this.completedObjectives.push(objectiveIndex);
            const objective = this.objectives[objectiveIndex];
            
            console.log(`目标完成: ${objective.description || objective.type}`);
            
            // 显示通知
            if (gameEngine && gameEngine.ui) {
                gameEngine.ui.showMessage(`目标完成: ${objective.description || objective.type}`, 'success');
            }
        }
    }
    
    // 完成任务
    complete() {
        this.status = 'completed';
        this.completeTime = Date.now();
        
        // 给予奖励
        this.giveRewards();
        
        console.log(`任务完成: ${this.name}`);
        
        if (gameEngine && gameEngine.ui) {
            gameEngine.ui.showMissionComplete(this);
        }
    }
    
    // 失败任务
    fail(reason = '未知原因') {
        this.status = 'failed';
        this.completeTime = Date.now();
        
        console.log(`任务失败: ${this.name} - ${reason}`);
        
        if (gameEngine && gameEngine.ui) {
            gameEngine.ui.showMessage(`任务失败: ${reason}`, 'error');
        }
    }
    
    // 给予奖励
    giveRewards() {
        if (gameEngine) {
            // TODO: 实现奖励系统
            console.log('获得奖励:', this.rewards);
        }
    }
    
    // 获取任务进度
    getProgress() {
        return {
            completed: this.completedObjectives.length,
            total: this.objectives.length,
            percentage: Math.round((this.completedObjectives.length / this.objectives.length) * 100)
        };
    }
    
    // 获取剩余时间
    getTimeRemaining() {
        if (!this.timeLimit || !this.startTime) return null;
        
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        return Math.max(0, this.timeLimit - elapsedTime);
    }
    
    // 获取任务信息
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            difficulty: this.difficulty,
            type: this.type,
            targetBody: this.targetBody,
            status: this.status,
            progress: this.getProgress(),
            timeRemaining: this.getTimeRemaining(),
            rewards: this.rewards,
            objectives: this.objectives.map((obj, index) => ({
                ...obj,
                completed: this.completedObjectives.includes(index)
            }))
        };
    }
}

// 任务管理器
class MissionManager {
    constructor() {
        this.availableMissions = [];
        this.activeMissions = [];
        this.completedMissions = [];
        this.failedMissions = [];
        
        this.initialized = false;
    }
    
    initialize() {
        console.log('初始化任务管理器...');
        
        // 创建初始任务
        this.createInitialMissions();
        
        this.initialized = true;
        console.log('任务管理器初始化完成');
    }
    
    createInitialMissions() {
        // 基础任务
        const basicMissions = [
            new Mission({
                name: '第一次飞行',
                description: '将载具发射到10,000米高度。',
                difficulty: 'easy',
                type: 'exploration',
                objectives: [
                    {
                        type: 'reach_altitude',
                        altitude: 10000,
                        description: '到达10,000米高度'
                    }
                ],
                rewards: {
                    funds: 10000,
                    science: 5,
                    reputation: 2
                }
            }),
            
            new Mission({
                name: '突破大气层',
                description: '将载具发射到70,000米高度，进入太空。',
                difficulty: 'easy',
                type: 'exploration',
                objectives: [
                    {
                        type: 'reach_altitude',
                        altitude: 70000,
                        description: '突破70,000米大气层边界'
                    }
                ],
                rewards: {
                    funds: 25000,
                    science: 15,
                    reputation: 5
                },
                requirements: {
                    completedMissions: ['第一次飞行']
                }
            }),
            
            new Mission({
                name: '进入轨道',
                description: '建立稳定的Kerbin轨道。',
                difficulty: 'medium',
                type: 'exploration',
                objectives: [
                    {
                        type: 'orbit',
                        minAltitude: 75000,
                        maxAltitude: 300000,
                        maxEccentricity: 0.2,
                        description: '建立稳定的低Kerbin轨道'
                    }
                ],
                rewards: {
                    funds: 50000,
                    science: 30,
                    reputation: 10
                }
            }),
            
            new Mission({
                name: '登陆Mun',
                description: '成功登陆Kerbin的卫星Mun。',
                difficulty: 'hard',
                type: 'exploration',
                targetBody: 'Mun',
                objectives: [
                    {
                        type: 'land',
                        body: 'Mun',
                        description: '在Mun表面软着陆'
                    },
                    {
                        type: 'plant_flag',
                        body: 'Mun',
                        description: '在Mun表面种植旗帜'
                    }
                ],
                rewards: {
                    funds: 100000,
                    science: 100,
                    reputation: 25
                }
            }),
            
            new Mission({
                name: 'Mun往返',
                description: '登陆Mun并安全返回Kerbin。',
                difficulty: 'hard',
                type: 'exploration',
                targetBody: 'Mun',
                objectives: [
                    {
                        type: 'land',
                        body: 'Mun',
                        description: '在Mun表面着陆'
                    },
                    {
                        type: 'return_home',
                        body: 'Kerbin',
                        description: '安全返回Kerbin'
                    }
                ],
                rewards: {
                    funds: 200000,
                    science: 200,
                    reputation: 50
                },
                timeLimit: 3600 // 1小时时间限制
            }),
            
            new Mission({
                name: '探索Minmus',
                description: '访问神秘的薄荷绿卫星Minmus。',
                difficulty: 'hard',
                type: 'exploration',
                targetBody: 'Minmus',
                objectives: [
                    {
                        type: 'orbit',
                        body: 'Minmus',
                        description: '进入Minmus轨道'
                    },
                    {
                        type: 'land',
                        body: 'Minmus',
                        description: '在Minmus表面着陆'
                    }
                ],
                rewards: {
                    funds: 150000,
                    science: 150,
                    reputation: 30
                }
            }),
            
            new Mission({
                name: '高速飞行',
                description: '达到超高速度进行大气层内飞行测试。',
                difficulty: 'medium',
                type: 'test',
                objectives: [
                    {
                        type: 'reach_speed',
                        speed: 500,
                        description: '达到500 m/s的速度'
                    },
                    {
                        type: 'reach_altitude',
                        altitude: 20000,
                        description: '在20,000米高度维持飞行'
                    }
                ],
                rewards: {
                    funds: 30000,
                    science: 20,
                    reputation: 8
                }
            })
        ];
        
        this.availableMissions = basicMissions;
    }
    
    update(gameState) {
        if (!this.initialized) return;
        
        // 更新活动任务
        this.activeMissions.forEach(mission => {
            mission.update(gameState);
            
            // 检查任务状态变化
            if (mission.status === 'completed') {
                this.completeMission(mission);
            } else if (mission.status === 'failed') {
                this.failMission(mission);
            }
        });
    }
    
    // 开始任务
    startMission(missionId) {
        const mission = this.availableMissions.find(m => m.id === missionId);
        
        if (mission && mission.start()) {
            // 从可用任务移动到活动任务
            const index = this.availableMissions.indexOf(mission);
            this.availableMissions.splice(index, 1);
            this.activeMissions.push(mission);
            
            return true;
        }
        
        return false;
    }
    
    // 完成任务
    completeMission(mission) {
        const index = this.activeMissions.indexOf(mission);
        if (index > -1) {
            this.activeMissions.splice(index, 1);
            this.completedMissions.push(mission);
            
            // 解锁新任务
            this.checkUnlockNewMissions();
        }
    }
    
    // 任务失败
    failMission(mission) {
        const index = this.activeMissions.indexOf(mission);
        if (index > -1) {
            this.activeMissions.splice(index, 1);
            this.failedMissions.push(mission);
            
            // 可以重新添加到可用任务中
            // this.availableMissions.push(mission);
        }
    }
    
    // 检查解锁新任务
    checkUnlockNewMissions() {
        // TODO: 根据完成的任务解锁新任务
    }
    
    // 获取任务列表
    getAvailableMissions() {
        return this.availableMissions.map(m => m.getInfo());
    }
    
    getActiveMissions() {
        return this.activeMissions.map(m => m.getInfo());
    }
    
    getCompletedMissions() {
        return this.completedMissions.map(m => m.getInfo());
    }
    
    // 获取任务统计
    getStats() {
        return {
            available: this.availableMissions.length,
            active: this.activeMissions.length,
            completed: this.completedMissions.length,
            failed: this.failedMissions.length,
            totalFundsEarned: this.completedMissions.reduce((sum, m) => sum + m.rewards.funds, 0),
            totalScienceEarned: this.completedMissions.reduce((sum, m) => sum + m.rewards.science, 0),
            totalReputationEarned: this.completedMissions.reduce((sum, m) => sum + m.rewards.reputation, 0)
        };
    }
}

// 全局任务管理器实例
let missionManager = null;

// 导出给其他模块使用
window.Mission = Mission;
window.MissionManager = MissionManager;
