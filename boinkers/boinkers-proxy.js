const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');
const { HttpsProxyAgent } = require('https-proxy-agent');

class Boink {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://boink.astronomica.io",
            "Referer": "https://boink.astronomica.io/?tgWebAppStartParam=boink376905749",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxies = this.loadProxies();
        this.currentProxyIndex = 0;
    }

    loadProxies() {
        try {
            return fs.readFileSync('./../data/proxy.txt', 'utf8').split('\n').filter(Boolean);
        } catch (error) {
            this.log('Không thể đọc file proxy.txt', 'error');
            return [];
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        return proxy;
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info');
    }

    async loginByTelegram(initDataString, proxy) {
        const url = "https://boink.astronomica.io/public/users/loginByTelegram?p=android";
        const payload = { initDataString };
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        try {
            const response = await axios.post(url, payload, { 
                headers: this.headers,
                httpsAgent: httpsAgent
            });
            if (response.status === 200) {
                return { success: true, token: response.data.token };
            } else {
                return { success: false, status: response.status };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    saveToken(userId, token) {
        let tokens = {};
        if (fs.existsSync('token.json')) {
            tokens = JSON.parse(fs.readFileSync('token.json', 'utf8'));
        }
        tokens[userId] = token;
        fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
    }

    getToken(userId) {
        if (fs.existsSync('token.json')) {
            const tokens = JSON.parse(fs.readFileSync('token.json', 'utf8'));
            return tokens[userId];
        }
        return null;
    }

    async getUserInfo(token, proxy) {
        const url = "https://boink.astronomica.io/api/users/me?p=android";
        const headers = { ...this.headers, "Authorization": token };
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        try {
            const response = await axios.get(url, { headers, httpsAgent });
            if (response.status === 200) {
                return { success: true, data: response.data };
            } else {
                return { success: false, status: response.status };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    extractFirstName(initDataString) {
        try {
            const decodedData = decodeURIComponent(initDataString.split('user=')[1].split('&')[0]);
            const userData = JSON.parse(decodedData);
            return userData.first_name;
        } catch (error) {
            this.log("Lỗi không lấy được first_name: " + error.message, 'error');
            return "Unknown";
        }
    }

    async upgradeBoinker(token, proxy) {
        const url = "https://boink.astronomica.io/api/boinkers/upgradeBoinker?p=android";
        const payload = {};
        const headers = { ...this.headers, "Authorization": token };
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        try {
            const response = await axios.post(url, payload, { headers, httpsAgent });
            if (response.status === 200 && response.data) {
                const { newSoftCurrencyAmount, newSlotMachineEnergy, rank } = response.data;
                this.log(`Nâng cấp thành công, Coin: ${newSoftCurrencyAmount} | Spin: ${newSlotMachineEnergy} | Rank: ${rank}`, 'success');
                return { success: true };
            } else {
                this.log(`Nâng cấp thất bại! Mã trạng thái: ${response.status}`, 'error');
                return { success: false };
            }
        } catch (error) {
            this.log(`Chưa đủ coin để nâng cấp tiếp!`, 'error');
            return { success: false, error: error.message };
        }
    }

    async claimBooster(token, spin, proxy) {
        const payload = spin > 30 
        ? { multiplier: 2, optionNumber: 3 } 
        : { multiplier: 2, optionNumber: 1 };
    
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        try {
            const response = await axios.post("https://boink.astronomica.io/api/boinkers/addShitBooster?p=android", payload, {
                headers: { ...this.headers, "Authorization": token },
                httpsAgent: httpsAgent
            });
            if (response.status === 200) {
                const result = response.data;
                let nextBoosterTime = result.boinker?.booster?.x2?.lastTimeFreeOptionClaimed
                    ? DateTime.fromISO(result.boinker.booster.x2.lastTimeFreeOptionClaimed)
                    : null;
    
                if (nextBoosterTime) {
                    nextBoosterTime = nextBoosterTime.plus({ hours: 2, minutes: 5 });
                }
    
                this.log(`Mua boosts thành công! Coin: ${result.userPostBooster.newCryptoCurrencyAmount || 0}`, 'success');
                this.log(`Rank: ${result.userPostBooster.rank}`, 'info');
                if (nextBoosterTime) {
                    this.log(`Mua boosts tiếp theo vào: ${nextBoosterTime.toLocaleString(DateTime.DATETIME_MED)}`, 'info');
                } else {
                    this.log(`Không thể xác định thời gian mua boosts tiếp theo.`, 'warning');
                }
                
                return { success: true, nextBoosterTime };
            } else {
                this.log(`Lỗi khi mua boosts!`, 'error');
                return { success: false, error: 'API error' };
            }
        } catch (error) {
            this.log(`Lỗi khi gửi yêu cầu mua boosts: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async spinSlotMachine(token, spins, proxy) {
        const spinAmounts = [150, 50, 25, 10, 5, 1];
        let remainingSpins = spins;
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        while (remainingSpins > 0) {
            let spinAmount = spinAmounts.find(amount => amount <= remainingSpins) || 1;
            
            const url = `https://boink.astronomica.io/api/play/spinSlotMachine/${spinAmount}?p=android`;
            const headers = { ...this.headers, "Authorization": token };
            
            try {
                const response = await axios.post(url, {}, { headers, httpsAgent });
                if (response.status === 200) {
                    const result = response.data;
                    this.log(`Spin thành công (${result.outcome}): Coin: ${result.newSoftCurrencyAmount.toString().white}${` | Shit: `.magenta}${result.newCryptoCurrencyAmount.toFixed(2).white}`.magenta, 'custom');
                    remainingSpins -= spinAmount;
                } else {
                    this.log(`Lỗi khi quay: Mã trạng thái ${response.status}`, 'error');
                    break;
                }
            } catch (error) {
                this.log(`Lỗi khi gửi yêu cầu quay: ${error.message}`, 'error');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000)); 
        }
    }

    async performRewardedActions(token, proxy) {
        const getRewardedActionListUrl = "https://boink.astronomica.io/api/rewardedActions/getRewardedActionList?p=android";
        const getUserInfoUrl = "https://boink.astronomica.io/api/users/me?p=android";
        const headers = { ...this.headers, "Authorization": token };
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
    
        const skippedTasks = [
            'twitterQuotePost20',
            'telegramShareStory5',
            'emojiOnPostTelegramNewsChannel',
            'NotGoldReward',
            'NotPlatinumReward',
            'connectTonWallet',
            'telegramJoinBoinkersNewsChannel',
            'telegramJoinAcidGames',
            'inviteAFriend'
        ];
    
        try {
            const userInfoResponse = await axios.get(getUserInfoUrl, { headers, httpsAgent });
            if (userInfoResponse.status !== 200) {
                this.log(`Không thể lấy thông tin người dùng. Mã trạng thái: ${userInfoResponse.status}`, 'error');
                return;
            }
            const userInfo = userInfoResponse.data;
    
            this.log("Đang lấy danh sách nhiệm vụ...", 'info');
            const response = await axios.get(getRewardedActionListUrl, { headers, httpsAgent });
            if (response.status !== 200) {
                this.log(`Không thể lấy danh sách nhiệm vụ. Mã trạng thái: ${response.status}`, 'error');
                return;
            }
    
            const rewardedActions = response.data;
            this.log(`Đã lấy được ${rewardedActions.length} nhiệm vụ`, 'success');
    
            for (const action of rewardedActions) {
                const nameId = action.nameId;
                
                if (skippedTasks.includes(nameId)) {
                    this.log(`Bỏ qua nhiệm vụ: ${nameId}`, 'warning');
                    continue;
                }
    
                const currentTime = new Date();
                let canPerformTask = true;
                let waitTime = null;
    
                if (userInfo.rewardedActions && userInfo.rewardedActions[nameId]) {
                    const lastClaimTime = new Date(userInfo.rewardedActions[nameId].claimDateTime);
                    
                    if (nameId === 'SeveralHourlsReward') {
                        const nextAvailableTime = new Date(lastClaimTime.getTime() + 6 * 60 * 60 * 1000);
                        if (currentTime < nextAvailableTime) {
                            canPerformTask = false;
                            waitTime = nextAvailableTime;
                        }
                    } else if (nameId === 'SeveralHourlsRewardedAdTask' || nameId === 'SeveralHourlsRewardedAdTask2') {
                        const nextAvailableTime = new Date(lastClaimTime.getTime() + 6 * 60 * 1000);
                        if (currentTime < nextAvailableTime) {
                            canPerformTask = false;
                            waitTime = nextAvailableTime;
                        }
                    } else if (userInfo.rewardedActions[nameId].claimDateTime) {
                        canPerformTask = false;
                    }
                }
    
                if (!canPerformTask) {
                    if (waitTime) {
                        const waitMinutes = Math.ceil((waitTime - currentTime) / (60 * 1000));
                        this.log(`Cần chờ ${waitMinutes} phút để tiếp tục làm nhiệm vụ ${nameId}`, 'info');
                    } else {
                        this.log(`Nhiệm vụ ${nameId} đã được hoàn thành trước đó`, 'info');
                    }
                    continue;
                }
    
                if (nameId === 'SeveralHourlsRewardedAdTask' || nameId === 'SeveralHourlsRewardedAdTask2') {
                    const providerId = nameId === 'SeveralHourlsRewardedAdTask' ? 'adsgram' : 'onclicka';
                    await this.handleAdTask(token, nameId, providerId, proxy);
                } else {
                    const clickUrl = `https://boink.astronomica.io/api/rewardedActions/rewardedActionClicked/${nameId}?p=android`;
                    try {
                        const clickResponse = await axios.post(clickUrl, {}, { headers, httpsAgent });
                        this.log(`Làm nhiệm vụ ${nameId.yellow}. trạng thái: ${`pending`.yellow}`);
                    } catch (clickError) {
                        this.log(`Lỗi khi làm nhiệm vụ ${nameId}: ${clickError.message}`, 'error');
                        if (clickError.response) {
                            this.log(`Chi tiết lỗi: ${JSON.stringify(clickError.response.data)}`, 'error');
                        }
                        continue;
                    }
    
                    this.log(`Đợi 2 giây trước khi nhận thưởng...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 2000));
    
                    const claimUrl = `https://boink.astronomica.io/api/rewardedActions/claimRewardedAction/${nameId}?p=android`;
                    try {
                        const claimResponse = await axios.post(claimUrl, {}, { headers, httpsAgent });
                        if (claimResponse.status === 200) {
                            const result = claimResponse.data;
                            const reward = result.prizeGotten;
                            this.log(`Hoàn thành nhiệm vụ ${nameId} thành công | Phần thưởng: ${reward}`, 'success');
                        } else {
                            this.log(`Không thể nhận thưởng cho ${nameId}. Mã trạng thái: ${claimResponse.status}`, 'error');
                        }
                    } catch (claimError) {
                        this.log(`Lỗi khi nhận thưởng cho ${nameId}: thời gian chờ vẫn còn!`, 'error');
                    }
                }
    
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            this.log(`Lỗi khi thực hiện các nhiệm vụ: ${error.message}`, 'error');
            if (error.response) {
                this.log(`Chi tiết lỗi: ${JSON.stringify(error.response.data)}`, 'error');
            }
        }
    }
    
    async handleAdTask(token, nameId, providerId, proxy) {
        const headers = { ...this.headers, "Authorization": token };
        const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : null;
    
        try {
            const clickUrl = `https://boink.astronomica.io/api/rewardedActions/rewardedActionClicked/${nameId}?p=android`;
            await axios.post(clickUrl, {}, { headers, httpsAgent });
            this.log(`Đã click nhiệm vụ quảng cáo ${nameId}`, 'success');
    
            await new Promise(resolve => setTimeout(resolve, 2000));
    
            const adWatchedUrl = "https://boink.astronomica.io/api/rewardedActions/ad-watched?p=android";
            await axios.post(adWatchedUrl, { providerId }, { headers, httpsAgent });
            this.log(`Đã xác nhận xem quảng cáo cho ${nameId}`, 'success');
    
            await new Promise(resolve => setTimeout(resolve, 2000));
    
            const claimUrl = `https://boink.astronomica.io/api/rewardedActions/claimRewardedAction/${nameId}?p=android`;
            this.log(`Gửi yêu cầu nhận thưởng cho nhiệm vụ quảng cáo ${nameId}...`, 'info');
            const claimResponse = await axios.post(claimUrl, {}, { headers, httpsAgent });
            
            if (claimResponse.status === 200) {
                const result = claimResponse.data;
                const reward = result.prizeGotten;
                this.log(`Hoàn thành nhiệm vụ quảng cáo ${nameId} thành công | Phần thưởng: ${reward}`, 'success');
            } else {
                this.log(`Không thể nhận thưởng cho nhiệm vụ quảng cáo ${nameId}. Mã trạng thái: ${claimResponse.status}`, 'error');
            }
        } catch (error) {
            this.log(`Lỗi khi xử lý nhiệm vụ quảng cáo ${nameId}: thời gian chờ vẫn còn!`, 'error');
        }
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent,
                timeout: 10000 
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    formatProxy(proxy) {
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

    async main() {
        const dataFile = path.join(__dirname, './../data/boinkers.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const initDataString = data[i];
                const firstName = this.extractFirstName(initDataString);
                const proxy = this.formatProxy(this.getNextProxy());

                let proxyIP = 'Unknown';
                if (proxy) {
                    try {
                        proxyIP = await this.checkProxyIP(proxy);
                    } catch (error) {
                        this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
                        continue;
                    }
                } else {
                    this.log('Không có proxy khả dụng', 'warning');
                }

                console.log(`========== Tài khoản ${i+1}/${data.length}  | ${firstName.green} | ip: ${proxyIP} ==========`);
                
                const parsedData = JSON.parse(decodeURIComponent(initDataString.split('user=')[1].split('&')[0]));
                const userId = parsedData.id;

                let token = this.getToken(userId);
                if (!token) {
                    this.log(`Không tìm thấy token cho tài khoản ${userId}, đăng nhập...`, 'warning');
                    const loginResult = await this.loginByTelegram(initDataString, proxy);
                    if (loginResult.success) {
                        this.log('Đăng nhập thành công!', 'success');
                        token = loginResult.token;
                        this.saveToken(userId, token);
                    } else {
                        this.log(`Đăng nhập không thành công! ${loginResult.status || loginResult.error}`, 'error');
                        continue; 
                    }
                } else {
                    this.log(`Token đã có sẵn cho tài khoản ${userId}.`, 'success');
                }

                try {
                    const userInfoResult = await this.getUserInfo(token, proxy);
                    if (userInfoResult.success) {
                        const userInfo = userInfoResult.data;
                        this.log(`Level: ${userInfo.boinkers.currentBoinkerProgression.level}`, 'info');
                        this.log(`Coin Balance: ${userInfo.currencySoft}`, 'info');
                        if (userInfo.currencyCrypto !== undefined) {
                            this.log(`Shit Balance: ${userInfo.currencyCrypto}`, 'info');
                        }
                        this.log(`Spin: ${userInfo.gamesEnergy.slotMachine.energy}`, 'info');

                        const currentTime = DateTime.now();
                        const lastClaimedTime = userInfo.boinkers?.booster?.x2?.lastTimeFreeOptionClaimed 
                            ? DateTime.fromISO(userInfo.boinkers.booster.x2.lastTimeFreeOptionClaimed) 
                            : null;
                        
                        if (!lastClaimedTime || currentTime > lastClaimedTime.plus({ hours: 2, minutes: 5 })) {
                            const boosterResult = await this.claimBooster(token, userInfo.gamesEnergy.slotMachine.energy, proxy);
                            if (!boosterResult.success) {
                                this.log(`Không thể claim booster: ${boosterResult.error}`, 'error');
                            }
                        } else {
                            const nextBoosterTime = lastClaimedTime.plus({ hours: 2, minutes: 5 });
                            this.log(`Thời gian mua boosts tiếp theo: ${nextBoosterTime.toLocaleString(DateTime.DATETIME_MED)}`, 'info');
                        }

                        const spinuser = await this.getUserInfo(token, proxy);
                        const spinUser = spinuser.data;
                        const spins = spinUser.gamesEnergy.slotMachine.energy;
                        if (spins > 0) {
                            this.log(`Bắt đầu quay với ${spins} lượt quay`, 'yellow');
                            await this.spinSlotMachine(token, spins, proxy);
                        } else {
                            this.log('Không có lượt quay nào', 'warning');
                        }

                        await this.performRewardedActions(token, proxy);

                        let upgradeSuccess = true;
                        while (upgradeSuccess) {
                            const upgradeResult = await this.upgradeBoinker(token, proxy);
                            upgradeSuccess = upgradeResult.success;
                        }
                    } else {
                        this.log(`Không thể lấy thông tin người dùng! Mã trạng thái: ${userInfoResult.status || userInfoResult.error}`, 'error');
                    }
                } catch (error) {
                    this.log(`Lỗi khi xử lý tài khoản: ${error.message}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(10 * 60); 
        }
    }
}

const boink = new Boink();
boink.main().catch(err => {
    boink.log(err.message, 'error');
    process.exit(1);
});