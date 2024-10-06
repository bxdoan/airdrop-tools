const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');


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

class YesCoinBot {
    constructor(accountIndex, account, proxy) {
        this.accountIndex = accountIndex;
        this.account = account;
        this.proxy = proxy;
        this.proxyIP = 'Unknown';
        this.token = null;
        this.config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
		this.timeout = 30000;
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

    async makeRequest(method, url, data = null, token, proxy, extraHeaders = {}) {
        const defaultHeaders = this.headers(token);
        const headers = {
            ...defaultHeaders,
            ...extraHeaders
        };
        const proxyAgent = new HttpsProxyAgent(proxy);
        const config = {
            method,
            url,
            headers,
            httpsAgent: proxyAgent,
            timeout: this.timeout,
        };
        if (data) {
            config.data = data;
        }
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`Yêu cầu hết thời gian sau ${this.timeout}ms`);
            }
            throw new Error(`Yêu cầu không thành công: ${error.message}`);
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

    async leaveSquad(token, proxy) {
        const url = 'https://api-backend.yescoin.gold/squad/leaveSquad';
        try {
            const response = await this.makeRequest('post', url, null, token, proxy);
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

    generateClaimSign(params, secretKey) {
        const { id, tm, claimType } = params;
        const inputString = id + tm + secretKey + claimType;
        const sign = crypto.createHash('md5').update(inputString).digest('hex');
        return sign;
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
                        const tm = Math.floor(Date.now() / 1000);
                        const claimData = {
                            id: offlineBonusInfo.data[0].transactionId,
                            createAt: tm,
                            claimType: 1,
                            destination: ""
                        };

                        const signParams = {
                            id: claimData.id,
                            tm: tm,
                            claimType: claimData.claimType
                        };

                        const secretKey = '6863b339db454f5bbd42ffb5b5ac9841';
                        const sign = this.generateClaimSign(signParams, secretKey);

                        const headers = {
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Cache-Control': 'no-cache',
                            'Content-Type': 'application/json',
                            'Origin': 'https://www.yescoin.gold',
                            'Pragma': 'no-cache',
                            'Referer': 'https://www.yescoin.gold/',
                            'Sec-Ch-Ua': '"Not.A/Brand";v="8", "Chromium";v="114"',
                            'Sec-Ch-Ua-Mobile': '?0',
                            'Sec-Ch-Ua-Platform': '"Windows"',
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-site',
                            'Sign': sign,
                            'Tm': tm.toString(),
                            'Token': token,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        };

                        const claimResponse = await this.makeRequest('post', claimUrl, claimData, token, proxy, headers);
                        if (claimResponse.code === 0) {
                            await this.log(`Claim offline bonus thành công, nhận ${claimResponse.data.collectAmount} coins`, 'success');
                        } else {
                            await this.log(`Claim offline bonus thất bại: ${claimResponse.message}`, 'error');
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

    async performTaskWithTimeout(task, taskName, timeoutMs = this.timeout) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`${taskName} hết thời gian sau ${timeoutMs}ms`));
            }, timeoutMs);

            try {
                const result = await task();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    async main() {
        try {
            try {
                this.proxyIP = await this.performTaskWithTimeout(
                    () => this.checkProxyIP(this.proxy),
                    'Checking proxy IP',
                    10000
                );
                await this.log(`Proxy IP: ${this.proxyIP}`, 'info');
            } catch (error) {
                await this.log(`Lỗi kiểm tra IP proxy: ${error.message}`, 'error');
                return;
            }

            try {
                this.token = await this.performTaskWithTimeout(
                    () => this.getOrRefreshToken(this.account, this.proxy),
                    'Getting token',
                    20000
                );
            } catch (error) {
                await this.log(`Không thể lấy token: ${error.message}`, 'error');
                return;
            }

            await this.performTasks();
        } catch (error) {
            await this.log(`Lỗi rồi: ${error.message}`, 'error');
        } finally {
            if (!isMainThread) {
                parentPort.postMessage('taskComplete');
            }
        }
    }

    async checkAndClaimTaskBonus(token, proxy) {
    const url = 'https://api-backend.yescoin.gold/task/getFinishTaskBonusInfo';
    try {
        const response = await this.makeRequest('get', url, null, token, proxy);
        if (response.code === 0) {
        const bonusInfo = response.data;
        const claimUrl = 'https://api-backend.yescoin.gold/task/claimBonus';

        if (bonusInfo.commonTaskBonusStatus === 1) {
            const claimResponse = await this.makeRequest('post', claimUrl, 2, token, proxy);
            if (claimResponse.code === 0) {
            await this.log(`Claim Common Task bonus thành công | phần thưởng ${claimResponse.data.bonusAmount}`, 'success');
            }
        }

        if (bonusInfo.dailyTaskBonusStatus === 1) {
            const claimResponse = await this.makeRequest('post', claimUrl, 1, token, proxy);
            if (claimResponse.code === 0) {
            await this.log(`Claim Daily Task bonus thành công | phần thưởng ${claimResponse.data.bonusAmount}`, 'success');
            }
        }

        if (bonusInfo.commonTaskBonusStatus !== 1 && bonusInfo.dailyTaskBonusStatus !== 1) {
            await this.log('Chưa đủ điều kiện nhận Task bonus', 'info');
            return false;
        }

        return true;
        } else {
        await this.log(`Không lấy được thông tin task bonus: ${response.message}`, 'error');
        return false;
        }
    } catch (error) {
        await this.log(`Lỗi khi kiểm tra và claim Task bonus: ${error.message}`, 'error');
        return false;
    }
    }

    async performDailyMissions(token, proxy) {
        try {
            const dailyMissionsUrl = 'https://api-backend.yescoin.gold/mission/getDailyMission';
            const dailyMissionsResponse = await this.makeRequest('get', dailyMissionsUrl, null, token, proxy);

            if (dailyMissionsResponse.code === 0) {
                for (const mission of dailyMissionsResponse.data) {
                    if (mission.missionStatus === 0) {

                        const clickUrl = 'https://api-backend.yescoin.gold/mission/clickDailyMission';
                        await this.makeRequest('post', clickUrl, mission.missionId, token, proxy);

                        const checkUrl = 'https://api-backend.yescoin.gold/mission/checkDailyMission';
                        const checkResponse = await this.makeRequest('post', checkUrl, mission.missionId, token, proxy);

                        if (checkResponse.code === 0 && checkResponse.data === true) {
                            const claimUrl = 'https://api-backend.yescoin.gold/mission/claimReward';
                            const claimResponse = await this.makeRequest('post', claimUrl, mission.missionId, token, proxy);

                            if (claimResponse.code === 0) {
                                const reward = claimResponse.data.reward;
                                await this.log(`Làm nhiệm vụ ${mission.name} thành công | Phần thưởng: ${reward}`, 'success');
                            } else {
                                await this.log(`Nhận thưởng nhiệm vụ ${mission.name} thất bại: ${claimResponse.message}`, 'error');
                            }
                        } else {
                            await this.log(`Kiểm tra nhiệm vụ ${mission.name} thất bại`, 'error');
                        }
                    }
                }
                return true;
            } else {
                await this.log(`Không thể lấy danh sách nhiệm vụ hàng ngày: ${dailyMissionsResponse.message}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Lỗi khi thực hiện nhiệm vụ hàng ngày: ${error.message}`, 'error');
            return false;
        }
    }

    generateSign(params, secretKey) {
        const { id, tm, signInType } = params;
        const inputString = id + tm + secretKey + signInType;
        const sign = crypto.createHash('md5').update(inputString).digest('hex');
        return sign;
    }

    async performDailySignIn(token, proxy) {
        try {
            const secretKey = '6863b339db454f5bbd42ffb5b5ac9841';
            const getCurrentTimestamp = () => Math.floor(Date.now() / 1000);

            // Lấy danh sách điểm danh
            const signInListUrl = 'https://api-backend.yescoin.gold/signIn/list';
            const signInListResponse = await this.makeRequest('get', signInListUrl, null, token, proxy);

            if (signInListResponse.code === 0) {
                const availableSignIn = signInListResponse.data.find(item => item.status === 1);

                if (availableSignIn) {
                    const tm = getCurrentTimestamp();
                    const signInUrl = 'https://api-backend.yescoin.gold/signIn/claim';
                    const signInData = {
                        id: availableSignIn.id,
                        createAt: tm,
                        signInType: 1,
                        destination: ""
                    };

                    const signParams = {
                        id: signInData.id,
                        tm: tm,
                        signInType: signInData.signInType
                    };

                    const sign = this.generateSign(signParams, secretKey);

                    // Header đầy đủ cho yêu cầu điểm danh
                    const headers = {
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Content-Type': 'application/json',
                        'Origin': 'https://www.yescoin.gold',
                        'Pragma': 'no-cache',
                        'Referer': 'https://www.yescoin.gold/',
                        'Sec-Ch-Ua': '"Not.A/Brand";v="8", "Chromium";v="114"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'Sign': sign,
                        'Tm': tm.toString(),
                        'Token': token,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
                    };

                    const signInResponse = await this.makeRequest('post', signInUrl, signInData, token, proxy, headers);
                    if (signInResponse.code === 0) {
                        const reward = signInResponse.data.reward;
                        await this.log(`Điểm danh hàng ngày thành công | Phần thưởng: ${reward}`, 'success');
                        return true;
                    } else {
                        await this.log(`Điểm danh hàng ngày thất bại: ${JSON.stringify({
                            code: signInResponse.code,
                            message: signInResponse.message,
                            data: signInResponse.data
                        })}`, 'error');
                        return false;
                    }
                } else {
                    await this.log(`Hôm nay bạn đã điểm danh rồi`, 'warning');
                    return false;
                }
            } else {
                await this.log(`Không thể lấy danh sách điểm danh: ${JSON.stringify({
                    code: signInListResponse.code,
                    message: signInListResponse.message,
                    data: signInListResponse.data
                })}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Lỗi khi thực hiện điểm danh hàng ngày: ${error.message}
            Stack: ${error.stack}
            Request details: ${JSON.stringify({
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers,
                data: error.config?.data
            })}
            Response: ${JSON.stringify({
                status: error.response?.status,
                data: error.response?.data
            })}`, 'error');
            return false;
        }
    }

    async performTasks() {
        try {
            const nickname = await this.performTaskWithTimeout(
                () => this.getuser(this.token, this.proxy),
                'Getting user info',
                15000
            );
            await this.log(`Tài khoản: ${nickname}`, 'info');

            const squadInfo = await this.performTaskWithTimeout(
                () => this.getSquadInfo(this.token, this.proxy),
                'Getting squad info',
                15000
            );
            if (squadInfo && squadInfo.data.isJoinSquad) {
                const squadTitle = squadInfo.data.squadInfo.squadTitle;
                const squadMembers = squadInfo.data.squadInfo.squadMembers;
                await this.log(`Squad: ${squadTitle} | ${squadMembers} Thành viên`, 'info');
                const leaveSquad = await this.performTaskWithTimeout(
                    () => this.leaveSquad(this.token, this.proxy),
                    'Leave squad',
                    20000
                );
                if (leaveSquad) {
                    const joinResult = await this.performTaskWithTimeout(
                        () => this.joinSquad(this.token, "t.me/vp_airdrop", this.proxy),
                        'Joining squad',
                        20000
                    );
                    if (joinResult) {
                        await this.log(`Squad: ${nickname} gia nhập Squad thành công !`, 'success');
                    } else {
                        await this.log(`Squad: ${nickname} gia nhập Squad thất bại !`, 'error');
                    }
                } else {
                    await this.log(`Squad: ${nickname} gia nhập Squad thất bại !`, 'error');
                }
            } else {
                await this.randomDelay();
                const joinResult = await this.performTaskWithTimeout(
                    () => this.joinSquad(this.token, "t.me/vp_airdrop", this.proxy),
                    'Joining squad',
                    20000
                );
                if (joinResult) {
                    await this.log(`Squad: ${nickname} gia nhập Squad thành công !`, 'success');
                } else {
                    await this.log(`Squad: ${nickname} gia nhập Squad thất bại !`, 'error');
                }
            }

            await this.performTaskWithTimeout(
                () => this.performDailySignIn(this.token, this.proxy),
                'Performing daily sign-in',
                30000
            );

            const balance = await this.performTaskWithTimeout(
                () => this.getAccountInfo(this.token, this.proxy),
                'Getting account info',
                15000
            );
            if (balance === null) {
                await this.log('Balance: Không đọc được balance', 'error');
            } else {
                const currentAmount = balance.data.currentAmount.toLocaleString().replace(/,/g, '.');
                await this.log(`Balance: ${currentAmount}`, 'info');
            }

            const gameInfo = await this.performTaskWithTimeout(
                () => this.getAccountBuildInfo(this.token, this.proxy),
                'Getting game info',
                15000
            );
            if (gameInfo === null) {
                await this.log('Không lấy được dữ liệu game!', 'error');
            } else {
                const { specialBoxLeftRecoveryCount, coinPoolLeftRecoveryCount, singleCoinValue, singleCoinLevel, coinPoolRecoverySpeed, swipeBotLevel } = gameInfo.data;
                await this.log(`Booster: Chest ${specialBoxLeftRecoveryCount} | Recovery ${coinPoolLeftRecoveryCount}`, 'info');
                await this.log(`Multivalue: ${singleCoinValue} | Coin Limit: ${singleCoinLevel} | Fill Rate: ${coinPoolRecoverySpeed} | Swipe Bot: ${swipeBotLevel}`, 'info');
            }

            await this.performTaskWithTimeout(
                () => this.handleSwipeBot(this.token, this.proxy),
                'Handling SwipeBot',
                30000
            );

            await this.performTaskWithTimeout(
                () => this.performDailyMissions(this.token, this.proxy),
                'Performing daily missions',
                60000
            );

            if (this.config.TaskEnable) {
                await this.performTaskWithTimeout(
                    () => this.processTasks(this.token, this.proxy),
                    'Processing tasks',
                    60000
                );
            }

            await this.performTaskWithTimeout(
                () => this.checkAndClaimTaskBonus(this.token, this.proxy),
                'Checking and claiming task bonus',
                30000
            );

            if (this.config.upgradeMultiEnable && gameInfo) {
                await this.performTaskWithTimeout(
                    () => this.upgradeLevel(this.token, gameInfo.data.singleCoinValue, this.config.maxLevel, '1', this.proxy),
                    'Upgrading Multi',
                    60000
                );
            }

            if (this.config.upgradeFillEnable && gameInfo) {
                await this.performTaskWithTimeout(
                    () => this.upgradeLevel(this.token, gameInfo.data.coinPoolRecoverySpeed, this.config.maxLevel, '2', this.proxy),
                    'Upgrading Fill',
                    60000
                );
            }

            const collectInfo = await this.performTaskWithTimeout(
                () => this.getGameInfo(this.token, this.proxy),
                'Getting collect info',
                15000
            );
            if (collectInfo === null) {
                await this.log('Không lấy được dữ liệu game!', 'error');
            } else {
                const { singleCoinValue, coinPoolLeftCount } = collectInfo.data;
                await this.log(`Năng lượng còn lại ${coinPoolLeftCount}`, 'info');

                if (coinPoolLeftCount > 0) {
                    const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                    const collectResult = await this.performTaskWithTimeout(
                        () => this.collectCoin(this.token, amount, this.proxy),
                        'Collecting coins',
                        30000
                    );
                    if (collectResult && collectResult.code === 0) {
                        const collectedAmount = collectResult.data.collectAmount;
                        await this.log(`Tap thành công, nhận được ${collectedAmount} coins`, 'success');
                    } else {
                        await this.log('Tap không thành công!', 'error');
                    }
                }
            }

            if (gameInfo && gameInfo.data.specialBoxLeftRecoveryCount > 0) {
                const useSpecialBoxResult = await this.performTaskWithTimeout(
                    () => this.useSpecialBox(this.token, this.proxy),
                    'Using special box',
                    30000
                );
                if (useSpecialBoxResult) {
                    const collectedAmount = await this.performTaskWithTimeout(
                        () => this.attemptCollectSpecialBox(this.token, 2, 240, this.proxy),
                        'Collecting from special box',
                        60000
                    );
                    await this.log(`Collected ${collectedAmount} from special box`, 'success');
                }
            }

            const updatedGameInfo = await this.performTaskWithTimeout(
                () => this.getAccountBuildInfo(this.token, this.proxy),
                'Getting updated game info',
                15000
            );
            if (updatedGameInfo && updatedGameInfo.data.coinPoolLeftRecoveryCount > 0) {
                const recoverResult = await this.performTaskWithTimeout(
                    () => this.recoverCoinPool(this.token, this.proxy),
                    'Recovering coin pool',
                    30000
                );
                if (recoverResult) {
                    const updatedCollectInfo = await this.performTaskWithTimeout(
                        () => this.getGameInfo(this.token, this.proxy),
                        'Getting updated collect info',
                        15000
                    );
                    if (updatedCollectInfo) {
                        const { coinPoolLeftCount, singleCoinValue } = updatedCollectInfo.data;
                        if (coinPoolLeftCount > 0) {
                            const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                            const collectResult = await this.performTaskWithTimeout(
                                () => this.collectCoin(this.token, amount, this.proxy),
                                'Collecting coins after recovery',
                                30000
                            );
                            if (collectResult && collectResult.code === 0) {
                                const collectedAmount = collectResult.data.collectAmount;
                                await this.log(`Tap thành công sau recovery, nhận được ${collectedAmount} coins`, 'success');
                            } else {
                                await this.log('Tap không thành công sau recovery!', 'error');
                            }
                        }
                    }
                }
            }

            const freeChestCollectedAmount = await this.performTaskWithTimeout(
                () => this.attemptCollectSpecialBox(this.token, 1, 200, this.proxy),
                'Collecting from free chest',
                30000
            );
            await this.log(`Collected ${freeChestCollectedAmount} from free chest`, 'success');

        } catch (error) {
            await this.log(`Error in performTasks: ${error.message}`, 'error');
        }
    }
}

if (isMainThread) {
    const accounts = fs.readFileSync('./../data/yescoin.txt', 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);
    const proxies = fs.readFileSync('./../data/proxy.txt', 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);
    if (!fs.existsSync('token.json')) {
        fs.writeFileSync('token.json', '');
        fs.appendFile('token.json', '{}', (err) => {
                if (err) {
                    this.log(`Lỗi khi lưu item vào file: ${err.message}`, 'red');
                }
        });
    }
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