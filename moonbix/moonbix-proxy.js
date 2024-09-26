const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class Binance {
    constructor() {
        this.currTime = Date.now();
        this.rs = 0;
        this.gameResponse = null;
        this.game = null;
        this.headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://www.binance.com",
            "Referer": "https://www.binance.com/vi/game/tg/moon-bix",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxies = this.loadProxies();
        this.axios = null;
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, './../data/proxy.txt');
        return fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);
    }

    initializeAxios(proxyUrl) {
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        this.axios = axios.create({
            headers: this.headers,
            httpsAgent: httpsAgent
        });
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    encrypt(text, key) {
        const iv = crypto.randomBytes(12);
        const ivBase64 = iv.toString('base64');
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), ivBase64.slice(0, 16));
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return ivBase64 + encrypted;
    }

    async callBinanceAPI(queryString) {
        const accessTokenUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/third-party/access/accessToken";
        const userInfoUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/user/user-info";

        try {
            const accessTokenResponse = await this.axios.post(accessTokenUrl, {
                queryString: queryString,
                socialType: "telegram"
            });

            if (accessTokenResponse.data.code !== "000000" || !accessTokenResponse.data.success) {
                throw new Error(`Failed to get access token: ${accessTokenResponse.data.message}`);
            }

            const accessToken = accessTokenResponse.data.data.accessToken;
            const userInfoHeaders = {
                ...this.headers,
                "X-Growth-Token": accessToken
            };

            const userInfoResponse = await this.axios.post(userInfoUrl, {
                resourceId: 2056
            }, { headers: userInfoHeaders });

            if (userInfoResponse.data.code !== "000000" || !userInfoResponse.data.success) {
                throw new Error(`Failed to get user info: ${userInfoResponse.data.message}`);
            }

            return { userInfo: userInfoResponse.data.data, accessToken };
        } catch (error) {
            this.log(`API call failed: ${error.message}`, 'error');
            return null;
        }
    }

    async startGame(accessToken) {
        try {
            const response = await this.axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/start',
                { resourceId: 2056 },
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );

            this.gameResponse = response.data;

            if (response.data.code === '000000') {
                this.log("Bắt đầu game thành công", 'success');
                return true;
            }

            if (response.data.code === '116002') {
                this.log("Không đủ lượt chơi!", 'warning');
            } else {
                this.log("Lỗi khi bắt đầu game!", 'error');
            }

            return false;
        } catch (error) {
            this.log(`Không thể bắt đầu game: ${error.message}`, 'error');
            return false;
        }
    }

    async getGameData() {
        try {
            const startTime = Date.now();
            const endTime = startTime + 45000;
            const gameTag = this.gameResponse.data.gameTag;
            const itemSettings = this.gameResponse.data.cryptoMinerConfig.itemSettingList;
    
            let currentTime = startTime;
            let score = 100;
            const gameEvents = [];
    
            while (currentTime < endTime) {
                const timeIncrement = Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500;
                currentTime += timeIncrement;
    
                if (currentTime >= endTime) break;
    
                const hookPosX = (Math.random() * (275 - 75) + 75).toFixed(3);
                const hookPosY = (Math.random() * (251 - 199) + 199).toFixed(3);
                const hookShotAngle = (Math.random() * 2 - 1).toFixed(3);
                const hookHitX = (Math.random() * (400 - 100) + 100).toFixed(3);
                const hookHitY = (Math.random() * (700 - 250) + 250).toFixed(3);
    
                let itemType, itemSize, points;
    
                const randomValue = Math.random();
                if (randomValue < 0.6) { 
                    const rewardItems = itemSettings.filter(item => item.type === "REWARD");
                    const selectedReward = rewardItems[Math.floor(Math.random() * rewardItems.length)];
                    itemType = 1;
                    itemSize = selectedReward.size;
                    points = Math.min(selectedReward.rewardValueList[0], 10);
                    score = Math.min(score + points, 200); 
                } else if (randomValue < 0.8) { 
                    const trapItems = itemSettings.filter(item => item.type === "TRAP");
                    const selectedTrap = trapItems[Math.floor(Math.random() * trapItems.length)];
                    itemType = 1;
                    itemSize = selectedTrap.size;
                    points = Math.min(Math.abs(selectedTrap.rewardValueList[0]), 20); 
                    score = Math.max(100, score - points); 
                } else { 
                    const bonusItem = itemSettings.find(item => item.type === "BONUS");
                    if (bonusItem) {
                        itemType = 2;
                        itemSize = bonusItem.size;
                        points = Math.min(bonusItem.rewardValueList[0], 15);
                        score = Math.min(score + points, 200);
                    } else {
                        itemType = 0;
                        itemSize = 0;
                        points = 0;
                    }
                }
    
                const eventData = `${currentTime}|${hookPosX}|${hookPosY}|${hookShotAngle}|${hookHitX}|${hookHitY}|${itemType}|${itemSize}|${points}`;
                gameEvents.push(eventData);
            }
    
            const payload = gameEvents.join(';');
            const encryptedPayload = this.encrypt(payload, gameTag);
    
            this.game = {
                payload: encryptedPayload,
                log: score
            };
    
            return true;
        } catch (error) {
            this.log(`Error in getGameData: ${error.message}`, 'error');
            this.game = null;
            return false;
        }
    }

    async completeGame(accessToken) {
        const stringPayload = this.game.payload;
        const payload = {
            resourceId: 2056,
            payload: stringPayload,
            log: this.game.log
        };
        try {
            const response = await this.axios.post(
                "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/complete",
                payload,
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );
            const data = response.data;
            if (data.success) {
                this.log(`Hoàn thành game thành công | Nhận được ${this.game.log} points`, 'custom');
                return true;
            } else {
                this.log(`Failed to complete game: ${JSON.stringify(data)}`, 'warning');
                return false;
            }
        } catch (error) {
            this.log(`Error completing game: ${error.message}`, 'error');
            return false;
        }
    }

    async getTaskList(accessToken) {
        const taskListUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/list";
        try {
            const response = await this.axios.post(taskListUrl, {
                resourceId: 2056
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Không thể lấy danh sách nhiệm vụ: ${response.data.message}`);
            }

            const taskList = response.data.data.data[0].taskList.data;
            const resourceIds = taskList
                .filter(task => task.completedCount === 0)
                .map(task => task.resourceId);
            
            return resourceIds;
        } catch (error) {
            this.log(`Không thể lấy danh sách nhiệm vụ: ${error.message}`, 'error');
            return null;
        }
    }

    async completeTask(accessToken, resourceId) {
        const completeTaskUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/complete";
        try {
            const response = await this.axios.post(completeTaskUrl, {
                resourceIdList: [resourceId],
                referralCode: null
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Không thể hoàn thành nhiệm vụ: ${response.data.message}`);
            }

            if (response.data.data.type) {
                this.log(`Làm nhiệm vụ ${response.data.data.type} thành công!`, 'success');
            }

            return true;
        } catch (error) {
            this.log(`Không thể hoàn thành nhiệm vụ: ${error.message}`, 'error');
            return false;
        }
    }

    async completeTasks(accessToken) {
        const resourceIds = await this.getTaskList(accessToken);
        if (!resourceIds || resourceIds.length === 0) {
            this.log("No uncompleted tasks found", 'info');
            return;
        }

        for (const resourceId of resourceIds) {
            if (resourceId !== 2058) {
                const success = await this.completeTask(accessToken, resourceId);
                if (success) {
                    this.log(`Đã hoàn thành nhiệm vụ: ${resourceId}`, 'success');
                } else {
                    this.log(`Không thể hoàn thành nhiệm vụ: ${resourceId}`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async playGameIfTicketsAvailable(queryString, accountIndex, firstName, proxyUrl) {
        let proxyIP = 'Unknown';
        try {
            proxyIP = await this.checkProxyIP(proxyUrl);
        } catch (error) {
            this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
        }

        console.log(`========== Tài khoản ${accountIndex} | ${firstName.green} | ip: ${proxyIP} ==========`);
        
        this.initializeAxios(proxyUrl);

        const result = await this.callBinanceAPI(queryString);
        if (!result) return;
    
        const { userInfo, accessToken } = result;
        const totalGrade = userInfo.metaInfo.totalGrade;
        let totalAttempts = userInfo.metaInfo.totalAttempts; 
        let consumedAttempts = userInfo.metaInfo.consumedAttempts; 
        let availableTickets = totalAttempts - consumedAttempts;
    
        this.log(`Tổng điểm: ${totalGrade}`);
        this.log(`Vé đang có: ${availableTickets}`);
        await this.completeTasks(accessToken);
        while (availableTickets > 0) {
            this.log(`Bắt đầu game với ${availableTickets} vé có sẵn`, 'info');
            
            if (await this.startGame(accessToken)) {
                if (await this.getGameData()) {
                    await this.countdown(45);
                    if (await this.completeGame(accessToken)) {
                        availableTickets--;
                        this.log(`Vé còn lại: ${availableTickets}`, 'info');
                    } else {
                        break;
                    }
                } else {
                    this.log("Không thể lấy dữ liệu trò chơi", 'error');
                    break;
                }
            } else {
                this.log("Không thể bắt đầu trò chơi", 'error');
                break;
            }
    
            if (availableTickets > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    
        if (availableTickets === 0) {
            this.log("Đã sử dụng hết vé", 'success');
        }
    }

    formatProxy(proxy) {
        // from ip:port:user:pass to http://user:pass@ip:port
        const parts = proxy.split(':');
        if (parts.length === 4) {
          return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`
        } else {
          return `http://${parts[0]}:${parts[1]}`;
        }
    }

    async main() {
        while (true) {
            const dataFile = path.join(__dirname, './../data/moonbix.txt');
            const data = fs.readFileSync(dataFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
            for (let i = 0; i < data.length; i++) {
                const queryString = data[i];
                const userData = JSON.parse(decodeURIComponent(queryString.split('user=')[1].split('&')[0]));
                const firstName = userData.first_name;
                const proxyUrl = this.formatProxy(this.proxies[i % this.proxies.length]);
                
                try {
                    await this.playGameIfTicketsAvailable(queryString, i + 1, firstName, proxyUrl);
                } catch (error) {
                    this.log(`Error processing account ${i + 1}: ${error.message}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(1440 * 60);
        }
    }
}

const client = new Binance();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});