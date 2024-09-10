const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class IamDogAPIClient {
    constructor() {
        this.baseUrl = 'https://api.iamdog.io';
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Origin": "https://app.iamdog.io",
            "Referer": "https://app.iamdog.io/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
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
            const timestamp = new Date().toLocaleTimeString();
            process.stdout.write(`\r[${timestamp}] [*] Chờ ${i} giây để tiếp tục ...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async login(queryId) {
        const url = `${this.baseUrl}/auth/login?${queryId}`;
        try {
            const response = await axios.post(url, {}, { headers: this.headers });
            if (response.status === 201 && response.data.status === 'success') {
                return response.data.api_token;
            } else {
                throw new Error('Login failed');
            }
        } catch (error) {
            this.log(`Login error: ${error.message}`, 'error');
            return null;
        }
    }

    async verifyToken(token) {
        const url = `${this.baseUrl}/auth/verify-token`;
        try {
            const response = await axios.get(url, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error('Token verification failed');
            }
        } catch (error) {
            this.log(`Token verification error: ${error.message}`, 'error');
            return null;
        }
    }

    async getClaimsInfo(token) {
        const url = `${this.baseUrl}/claims/info`;
        try {
            const response = await axios.get(url, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error('Failed to get claims info');
            }
        } catch (error) {
            this.log(`Claims info error: ${error.message}`, 'error');
            return null;
        }
    }

    async processDailyReward(token, day) {
        const url = `${this.baseUrl}/claims/process`;
        const payload = { type: "DAILY_REWARDS", day };
        try {
            const response = await axios.post(url, payload, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response) {
                return response.data;
            } else {
                throw new Error('Không thể điểm danh hàng ngày');
            }
        } catch (error) {
            this.log(`Lỗi rồi: ${error.message}`, 'error');
            return null;
        }
    }


    async activateBoost(token) {
        const url = `${this.baseUrl}/game/boost`;
        try {
            const response = await axios.post(url, {}, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response) {
                const data = response.data;
                const nextBoostTime = DateTime.fromISO(data.boostUnlockedAt).setZone('Asia/Ho_Chi_Minh');
                this.log(`Boost kích hoạt: ${data.boostSeconds}s x5 tap, tiếp theo: ${nextBoostTime.toFormat('HH:mm:ss dd/MM/yyyy')}`, 'success');
                return data;
            } else {
                throw new Error('Failed to activate boost');
            }
        } catch (error) {
            if (error.response && error.response.data && error.response.data.message) {
                const cooldownTime = error.response.data.message.match(/completed at (.+?) or/);
                if (cooldownTime) {
                    const nextBoostTime = DateTime.fromJSDate(new Date(cooldownTime[1])).setZone('Asia/Ho_Chi_Minh');
                    this.log(`Không thể boost. Tiếp theo: ${nextBoostTime.toFormat('HH:mm:ss dd/MM/yyyy')}`, 'warning');
                } else {
                    this.log(`Không thể boost: ${error.response.data.message}`, 'warning');
                }
            } else {
                this.log(`Lỗi kích hoạt boost: ${error.message}`, 'error');
            }
            return null;
        }
    }

    async claimTaps(token, tapsWithBoost = 0, taps = 0) {
        const url = `${this.baseUrl}/claims/tap`;
        const payload = { taps, tapsWithBoost };
    
        const attemptTap = async () => {
            try {
                const response = await axios.post(url, payload, {
                    headers: {
                        ...this.headers,
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response) {
                    const data = response.data;
                    if (data) {
                        this.log(`Tap thành công | balance: ${data.balance}`, 'success');
                        return data;
                    } else {
                        this.log(`Tap không thành công: ${data.message || 'Không có thông báo lỗi'}`);
                    }
                } else {
                    this.log(`Unexpected response status: ${response.status}`);
                }
            } catch (error) {
                if (error.response && error.response.status === 400 && error.response.data.message === "Wait for tap to cool down.") {
                    this.log("Năng lượng chưa đầy, không thể tap. Đợi 60 giây...", 'warning');
                    await this.countdown(60);
                    return null;
                } else {
                    throw error;
                }
            }
        };
    
        let attempts = 0;
        const maxAttempts = 5;
    
        while (attempts < maxAttempts) {
            const result = await attemptTap();
            if (result) return result;
            attempts++;
        }
    
        this.log(`Đã thử tap ${maxAttempts} lần nhưng không thành công. Bỏ qua và tiếp tục.`, 'error');
        return null;
    }

    async checkAndUpgradeMeme(token) {
        try {
            const userMemeResponse = await axios.get(`${this.baseUrl}/users/memes?page=1&limit=10`, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const primaryMeme = userMemeResponse.data.primaryMeme;
            this.log(`Đang sử dụng ${primaryMeme.name} level ${primaryMeme.level}`, 'info');
    
            const memeInfoResponse = await axios.get(`${this.baseUrl}/meme?page=1&limit=50`, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
    
            const memeInfo = memeInfoResponse.data.data.find(meme => meme.key === primaryMeme.key);
            const nextLevel = primaryMeme.level + 1;
            const nextLevelInfo = memeInfo.levels[nextLevel];
    
            if (!nextLevelInfo) {
                this.log(`Đã đạt level tối đa cho ${primaryMeme.name}`, 'info');
                return;
            }
            const userInfo = await this.verifyToken(token);
            if (userInfo.balance >= nextLevelInfo.amount) {
                const upgradeResponse = await axios.post(
                    `${this.baseUrl}/users/meme/upgrade/${primaryMeme._id}`,
                    {},
                    {
                        headers: {
                            ...this.headers,
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
    
                const upgradedMeme = upgradeResponse.data;
                this.log(`Đã mua ${upgradedMeme.name} level ${upgradedMeme.level}`, 'success');
            } else {
                this.log(`Không đủ balance để nâng cấp. Cần: ${nextLevelInfo.amount}, Hiện có: ${userInfo.balance}`, 'warning');
            }
        } catch (error) {
            this.log(`Lỗi khi kiểm tra/nâng cấp Meme: ${error.message}`, 'error');
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }))
    }

    async processAccount(queryId, index, hoinangcap) {
        const token = await this.login(queryId);
        if (token) {
            const userInfo = await this.verifyToken(token);
            if (userInfo) {
                console.log(`========== Tài khoản ${index + 1} | ${userInfo.name.green} ==========`);
                this.log(`Balance: ${userInfo.balance}`);
                this.log(`Level: ${userInfo.level}`);
                if (hoinangcap) {
                    await this.checkAndUpgradeMeme(token);
                }

                const claimsInfo = await this.getClaimsInfo(token);
                if (claimsInfo) {
                    const now = DateTime.now();
                    const unlockTime = claimsInfo.daiy.dailyRewardsUnlockedAt ? 
                        DateTime.fromISO(claimsInfo.daiy.dailyRewardsUnlockedAt) : 
                        now.minus({ days: 1 });

                    if (now > unlockTime) {
                        const result = await this.processDailyReward(token, claimsInfo.daiy.daysRewarded);
                        if (result) {
                            this.log(`Điểm danh hàng ngày thành công`);
                            const nextUnlockTime = DateTime.fromISO(result.claimInfo.daiy.dailyRewardsUnlockedAt);
                            this.log(`Thời gian điểm danh tiếp theo: ${nextUnlockTime.toLocaleString(DateTime.DATETIME_FULL)}`);
                        }
                    } else {
                        this.log(`Chưa đến thời gian điểm danh. Next: ${unlockTime.toLocaleString(DateTime.DATETIME_FULL)}`);
                    }
                }

                const tapsCount = Math.floor(claimsInfo.farm.maxFarmRewards / 100);

                const boostResult = await this.activateBoost(token);
                if (boostResult) {
                    await this.claimTaps(token, tapsCount, 0);
                } else {
                    await this.claimTaps(token, 0, tapsCount);
                }
            }
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        this.log('Tool được chia sẻ tại kênh telegram Dân Cày Airdrop (@dancayairdrop)');
        const nangcap = await this.askQuestion('Bạn có muốn nâng cấp nhân vật không? (y/n): ');
        const hoinangcap = nangcap.toLowerCase() === 'y';

        while (true) {

            for (let i = 0; i < data.length; i++) {
                const queryId = data[i];
                await this.processAccount(queryId, i, hoinangcap);
                await this.countdown(3);
            }
            await this.countdown(60);
        }
    }
}

const client = new IamDogAPIClient();
client.main().catch(err => {
    console.error(err.message);
    process.exit(1);
});