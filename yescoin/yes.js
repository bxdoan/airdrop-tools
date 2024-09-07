const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// try load ./../.env file and get DATA_DIR environment variable
try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}
catch (error) {
    console.error('Không thể load file .env');
}
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');


class YesCoinBot {
    constructor(accountIndex, account, proxy) {
        this.accountIndex = accountIndex;
        this.account = account;
        this.proxy = proxy;
        this.proxyIP = 'Unknown';
        this.token = null;
        this.config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    }

    async log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const accountPrefix = `[Tài khoản ${this.accountIndex + 1}]`;
        const ipPrefix = this.proxyIP ? `[${this.proxyIP}]` : '[Unknown IP]';
        let logMessage = '';
        
        switch(type) {
            case 'success':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
                break;
            case 'error':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
                break;
            case 'warning':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
                break;
            default:
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
        }
        
        console.log(logMessage);
        await this.randomDelay();
    }

    headers(token) {
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://www.yescoin.gold',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://www.yescoin.gold/',
            'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24", "Microsoft Edge WebView2";v="125"',
            'sec-Ch-Ua-Mobile': '?1',
            'sec-Ch-Ua-Platform': '"Android"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'token': token,
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
        };
    }

    formatLoginPayload(encodedData) {
        const decodedData = decodeURIComponent(encodedData);
        return { code: decodedData };
    }

    async login(encodedData, proxy) {
        const url = 'https://api-backend.yescoin.gold/user/login';
        const formattedPayload = this.formatLoginPayload(encodedData);
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'origin': 'https://www.yescoin.gold',
            'referer': 'https://www.yescoin.gold/',
            'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128", "Microsoft Edge WebView2";v="128"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
        };

        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.post(url, formattedPayload, { headers, httpsAgent: proxyAgent });
            if (response.data.code === 0) {
                const token = response.data.data.token;
                return token;
            } else {
                throw new Error(`Đăng nhập thất bại: ${response.data.message}`);
            }
        } catch (error) {
            throw new Error(`Đăng nhập thất bại: ${error.message}`);
        }
    }

    async saveToken(accountIndex, token) {
        let tokens = {};
        if (fs.existsSync('token.json')) {
            tokens = JSON.parse(fs.readFileSync('token.json', 'utf-8'));
        }
        tokens[accountIndex] = token;
        fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
    }

    loadToken(accountIndex) {
        if (fs.existsSync('token.json')) {
            const tokens = JSON.parse(fs.readFileSync('token.json', 'utf-8'));
            return tokens[accountIndex];
        }
        return null;
    }

    async getOrRefreshToken(encodedData, proxy) {
        const savedToken = this.loadToken(this.accountIndex);
        if (savedToken) {
            this.token = savedToken;
            return this.token;
        }
        
        this.token = await this.login(encodedData, proxy);
        await this.saveToken(this.accountIndex, this.token);
        return this.token;
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

    async makeRequest(method, url, data = null, token, proxy) {
        const headers = this.headers(token);
        const proxyAgent = new HttpsProxyAgent(proxy);
        const config = {
            method,
            url,
            headers,
            httpsAgent: proxyAgent,
        };
        if (data) {
            config.data = data;
        }
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            throw new Error(`Request failed: ${error.message}`);
        }
    }

    async randomDelay() {
        const delay = Math.floor(Math.random() * 1000) + 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async collectCoin(token, amount, proxy) {
        const url = 'https://api.yescoin.gold/game/collectCoin';
        try {
            const response = await this.makeRequest('post', url, amount, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getAccountInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/account/getAccountInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getGameInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/game/getGameInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async useSpecialBox(token, proxy) {
        const url = 'https://api.yescoin.gold/game/recoverSpecialBox';
        try {
            const response = await this.makeRequest('post', url, {}, token, proxy);
            if (response.code === 0) {
                await this.log('Kích hoạt rương...', 'success');
                return true;
            } else {
                await this.log('Kích hoạt rương thất bại!', 'error');
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async getSpecialBoxInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/game/getSpecialBoxInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getuser(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/account/getRankingList?index=1&pageSize=1&rankType=1&userLevel=1';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.data.myUserNick) {
                return response.data.myUserNick;
            }
            return "no nickname";
        } catch (error) {
            return "no nickname";
        }
    }

    async collectFromSpecialBox(token, boxType, coinCount, proxy) {
        const url = 'https://api.yescoin.gold/game/collectSpecialBoxCoin';
        const data = { boxType, coinCount };
        try {
            const response = await this.makeRequest('post', url, data, token, proxy);
            if (response.code === 0) {
                if (response.data.collectStatus) {
                    await this.log(`Mở rương nhận được ${response.data.collectAmount} Coins`, 'success');
                    return { success: true, collectedAmount: response.data.collectAmount };
                } else {
                    return { success: true, collectedAmount: 0 };
                }
            } else {
                return { success: false, collectedAmount: 0 };
            }
        } catch (error) {
            return { success: false, collectedAmount: 0 };
        }
    }

    async attemptCollectSpecialBox(token, boxType, initialCoinCount, proxy) {
        let coinCount = initialCoinCount;
        while (coinCount > 0) {
            const result = await this.collectFromSpecialBox(token, boxType, coinCount, proxy);
            if (result.success) {
                return result.collectedAmount;
            }
            coinCount -= 20;
        }
        await this.log('Không thể thu thập rương!', 'error');
        return 0;
    }

    async getAccountBuildInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/build/getAccountBuildInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getSquadInfo(token, proxy) {
        const url = 'https://api.yescoin.gold/squad/mySquad';
        try {
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async joinSquad(token, squadLink, proxy) {
        const url = 'https://api.yescoin.gold/squad/joinSquad';
        const data = { squadTgLink: squadLink };
        try {
            const response = await this.makeRequest('post', url, data, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async recoverCoinPool(token, proxy) {
        const url = 'https://api.yescoin.gold/game/recoverCoinPool';
        try {
            const response = await this.makeRequest('post', url, {}, token, proxy);
            if (response.code === 0) {
                await this.log('Recovery thành công!', 'success');
                return true;
            } else {
                await this.log('Recovery thất bại!', 'error');
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async getTaskList(token, proxy) {
        const url = 'https://api.yescoin.gold/task/getCommonTaskList';
        try {
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response.data;
            } else {
                await this.log(`Không lấy được danh sách nhiệm vụ: ${response.message}`, 'error');
                return null;
            }
        } catch (error) {
            await this.log('Error: ' + error.message, 'error');
            return null;
        }
    }

    async finishTask(token, taskId, proxy) {
        const url = 'https://api.yescoin.gold/task/finishTask';
        try {
            const response = await this.makeRequest('post', url, taskId, token, proxy);
            if (response.code === 0) {
                await this.log(`Làm nhiệm vụ ${taskId} thành công | Phần thưởng: ${response.data.bonusAmount}`, 'success');
                return true;
            } else {
                await this.log(`Làm nhiệm vụ ${taskId} thất bại: ${response.message}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, 'error');
            return false;
        }
    }

    async processTasks(token, proxy) {
        const tasks = await this.getTaskList(token, proxy);
        if (tasks) {
            for (const task of tasks) {
                if (task.taskStatus === 0) {
                    await this.finishTask(token, task.taskId, proxy);
                }
            }
        }
    }

    async upgradeLevel(token, currentLevel, targetLevel, upgradeType, proxy) {
        const url = 'https://api.yescoin.gold/build/levelUp';
        const upgradeTypeName = upgradeType === '1' ? 'Multi Value' : 'Fill Rate';

        while (currentLevel < targetLevel) {
            try {
                const response = await this.makeRequest('post', url, upgradeType, token, proxy);
                if (response.code === 0) {
                    currentLevel++;
                    await this.log(`Nâng cấp ${upgradeTypeName} lên Lv ${currentLevel}`, 'success');
                } else {
                    await this.log(`Nâng cấp thất bại: ${response.message}`, 'error');
                    break;
                }
            } catch (error) {
                await this.log('Lỗi nâng cấp: ' + error.message, 'error');
                break;
            }
        }

        if (currentLevel === targetLevel) {
            await this.log(`${upgradeTypeName} đã ở cấp độ ${currentLevel}`, 'info');
        }
    }

    async handleSwipeBot(token, proxy) {
        const url = 'https://api.yescoin.gold/build/getAccountBuildInfo';
        try {
            const accountBuildInfo = await this.makeRequest('get', url, null, token, proxy);
            if (accountBuildInfo.code === 0) {
                const { swipeBotLevel, openSwipeBot } = accountBuildInfo.data;
                if (swipeBotLevel < 1) {
                    const upgradeUrl = 'https://api.yescoin.gold/build/levelUp';
                    const upgradeResponse = await this.makeRequest('post', upgradeUrl, 4, token, proxy);
                    if (upgradeResponse.code === 0) {
                        await this.log('Mua SwipeBot thành công', 'success');
                    } else {
                        await this.log('Mua SwipeBot thất bại', 'error');
                    }
                }
    
                if (swipeBotLevel >= 1 && !openSwipeBot) {
                    const toggleUrl = 'https://api.yescoin.gold/build/toggleSwipeBotSwitch';
                    const toggleResponse = await this.makeRequest('post', toggleUrl, true, token, proxy);
                    if (toggleResponse.code === 0) {
                        await this.log('Bật SwipeBot thành công', 'success');
                    } else {
                        await this.log('Bật SwipeBot thất bại', 'error');
                    }
                }
    
                if (swipeBotLevel >= 1 && openSwipeBot) {
                    const offlineBonusUrl = 'https://api.yescoin.gold/game/getOfflineYesPacBonusInfo';
                    const offlineBonusInfo = await this.makeRequest('get', offlineBonusUrl, null, token, proxy);
                    if (offlineBonusInfo.code === 0 && offlineBonusInfo.data.length > 0) {
                        const claimUrl = 'https://api.yescoin.gold/game/claimOfflineBonus';
                        const claimData = {
                            id: offlineBonusInfo.data[0].transactionId,
                            createAt: Math.floor(Date.now() / 1000),
                            claimType: 1,
                            destination: ""
                        };
                        const claimResponse = await this.makeRequest('post', claimUrl, claimData, token, proxy);
                        if (claimResponse.code === 0) {
                            await this.log(`Claim offline bonus thành công, nhận ${claimResponse.data.collectAmount} coins`, 'success');
                        } else {
                            await this.log('Claim offline bonus thất bại', 'error');
                        }
                    }
                }
            } else {
                await this.log('Không thể lấy thông tin SwipeBot', 'error');
            }
        } catch (error) {
            await this.log(`Lỗi xử lý SwipeBot: ${error.message}`, 'error');
        }
    }

    async main() {
        try {
            this.proxyIP = await this.checkProxyIP(this.proxy);
        } catch (error) {
            await this.log(`Error checking proxy IP: ${error.message}`, 'error');
            return;
        }

        try {
            this.token = await this.getOrRefreshToken(this.account, this.proxy);
        } catch (error) {
            await this.log(`Không thể lấy token: ${error.message}`, 'error');
            return;
        }

        await this.performTasks();
    }

    async performTasks() {
        await this.randomDelay();
        const nickname = await this.getuser(this.token, this.proxy);
        await this.log(`Tài khoản: ${nickname}`, 'info');
        
        await this.randomDelay();
        const squadInfo = await this.getSquadInfo(this.token, this.proxy);
        if (squadInfo && squadInfo.data.isJoinSquad) {
            const squadTitle = squadInfo.data.squadInfo.squadTitle;
            const squadMembers = squadInfo.data.squadInfo.squadMembers;
            await this.log(`Squad: ${squadTitle} | ${squadMembers} Thành viên`, 'info');
        } else {
            await this.log('Squad: Bạn không ở trong Squad, gia nhập Dân Cày Airdrop.', 'warning');
            await this.randomDelay();
            const joinResult = await this.joinSquad(this.token, "t.me/dancayairdrop", this.proxy);
            if (joinResult) {
                await this.log(`Squad: ${nickname} gia nhập Squad thành công !`, 'success');
            } else {
                await this.log(`Squad: ${nickname} gia nhập Squad thất bại !`, 'error');
            }
        }

        await this.randomDelay();
        const balance = await this.getAccountInfo(this.token, this.proxy);
        if (balance === null) {
            await this.log('Balance: Không đọc được balance', 'error');
        }

        const currentAmount = balance.data.currentAmount.toLocaleString().replace(/,/g, '.');
        await this.randomDelay();
        const gameInfo = await this.getAccountBuildInfo(this.token, this.proxy);
        if (gameInfo === null) {
            await this.log('Không lấy được dữ liệu game!', 'error');
        } else {
            const { specialBoxLeftRecoveryCount, coinPoolLeftRecoveryCount, singleCoinValue, singleCoinLevel, coinPoolRecoverySpeed, swipeBotLevel } = gameInfo.data;
            await this.log(`Balance: ${currentAmount} | Booster: Chest ${specialBoxLeftRecoveryCount} | Recovery ${coinPoolLeftRecoveryCount}`, 'info');
            await this.log(`Multivalue: ${singleCoinValue} | Coin Limit: ${singleCoinLevel} | Fill Rate: ${coinPoolRecoverySpeed} | Swipe Bot: ${swipeBotLevel}`, 'info');
        }

        await this.randomDelay();
        await this.handleSwipeBot(this.token, this.proxy);

        if (this.config.TaskEnable) {
            await this.randomDelay();
            await this.processTasks(this.token, this.proxy);
        }

        if (this.config.upgradeMultiEnable) {
            await this.randomDelay();
            await this.upgradeLevel(this.token, gameInfo.data.singleCoinValue, this.config.maxLevel, '1', this.proxy);
        }

        if (this.config.upgradeFillEnable) {
            await this.randomDelay();
            await this.upgradeLevel(this.token, gameInfo.data.coinPoolRecoverySpeed, this.config.maxLevel, '2', this.proxy);
        }

        await this.randomDelay();
        const collectInfo = await this.getGameInfo(this.token, this.proxy);
        if (collectInfo === null) {
            await this.log('Không lấy được dữ liệu game!', 'error');
        } else {
            const { singleCoinValue, coinPoolLeftCount } = collectInfo.data;
            await this.log(`Năng lượng còn lại ${coinPoolLeftCount}`, 'info');

            if (coinPoolLeftCount > 0) {
                await this.randomDelay();
                const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                const collectResult = await this.collectCoin(this.token, amount, this.proxy);
                if (collectResult && collectResult.code === 0) {
                    const collectedAmount = collectResult.data.collectAmount;
                    await this.log(`Tap thành công, nhận được ${collectedAmount} coins`, 'success');
                } else {
                    await this.log('Tap không thành công!', 'error');
                }
            }
        }

        await this.randomDelay();
        if (gameInfo && gameInfo.data.specialBoxLeftRecoveryCount > 0) {
            if (await this.useSpecialBox(this.token, this.proxy)) {
                await this.randomDelay();
                const collectedAmount = await this.attemptCollectSpecialBox(this.token, 2, 240, this.proxy);
            }
        }

        await this.randomDelay();
        const updatedGameInfo = await this.getAccountBuildInfo(this.token, this.proxy);
        if (updatedGameInfo && updatedGameInfo.data.coinPoolLeftRecoveryCount > 0) {
            if (await this.recoverCoinPool(this.token, this.proxy)) {
                await this.randomDelay();
                const updatedCollectInfo = await this.getGameInfo(this.token, this.proxy);
                if (updatedCollectInfo) {
                    const { coinPoolLeftCount, singleCoinValue } = updatedCollectInfo.data;
                    if (coinPoolLeftCount > 0) {
                        await this.randomDelay();
                        const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                        const collectResult = await this.collectCoin(this.token, amount, this.proxy);
                        if (collectResult && collectResult.code === 0) {
                            const collectedAmount = collectResult.data.collectAmount;
                            await this.log(`Tap thành công, nhận được ${collectedAmount} coins`, 'success');
                        } else {
                            await this.log('Tap không thành công!', 'error');
                        }
                    }
                }
            }
        }

        await this.randomDelay();
        const freeChestCollectedAmount = await this.attemptCollectSpecialBox(this.token, 1, 200, this.proxy);

        if (!isMainThread) {
            parentPort.postMessage('taskComplete');
        }
    }
}


function formatProxy(proxy) {
    // from ip:port:user:pass to http://user:pass@ip:port
    // if http format, just keep it
    if (proxy.startsWith('http')) {
        return proxy;
    }
    const parts = proxy.split(':');
    if (parts.length === 4) {
        return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`
    } else {
        return `http://${parts[0]}:${parts[1]}`;
    }
}


if (isMainThread) {
    const accounts = fs.readFileSync(`${DATA_DIR}/yescoin.txt`, 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);
    const proxies = fs.readFileSync(`${DATA_DIR}/proxy.txt`, 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

    const numThreads = Math.min(config.maxThreads || 10, accounts.length);
    let activeWorkers = 0;

    async function processCycle() {
        console.log('Đã dùng thì đừng sợ, đã sợ thì đừng dùng...'.magenta);
        let accountQueue = [...accounts];

        function startWorker() {
            if (accountQueue.length === 0) {
                if (activeWorkers === 0) {
                    console.log('Hoàn thành tất cả tài khoản, nghỉ 1 chút nhé.'.green);
                    setTimeout(processCycle, 60000);
                }
                return;
            }

            const accountIndex = accounts.length - accountQueue.length;
            const account = accountQueue.shift();
            const proxy = formatProxy(proxies[accountIndex % proxies.length]);

            activeWorkers++;

            const worker = new Worker(__filename, {

                workerData: {
                    accountIndex: accountIndex,
                    account: account,
                    proxy: proxy
                }
            });

            worker.on('message', (message) => {
                if (message === 'taskComplete') {
                    worker.terminate();
                }
            });

            worker.on('error', (error) => {
                console.error(`Worker error: ${error}`.red);
                activeWorkers--;
                startWorker();
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Luồng bị dừng với mã ${code}`.red);
                }
                activeWorkers--;
                startWorker();
            });
        }

        for (let i = 0; i < numThreads; i++) {
            startWorker();
        }
    }
    processCycle();

} else {
    const bot = new YesCoinBot(workerData.accountIndex, workerData.account, workerData.proxy);
    bot.main().catch(console.error);
}