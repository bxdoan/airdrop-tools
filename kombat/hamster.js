const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const readline = require('readline');

class HamsterKombatGame {
    constructor() {
        this.BASE_URL = 'https://api.hamsterkombatgame.io';
        this.TIMEOUT = 30000;
        this.UPGRADE_DIEUKIEN = 500000;
        this.authorizationList = this.readCSV('authorization.csv');
        this.proxyList = this.readCSV('proxy.csv');
        this.promoCodeFile = 'code.txt';
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    readCSV(filename) {
        const csvData = fs.readFileSync(filename, 'utf8');
        return csvData.split('\n').map(line => line.trim()).filter(line => line !== '');
    }

    createAxiosInstance(proxy) {
        const proxyAgent = new HttpsProxyAgent(proxy);
        return axios.create({
            baseURL: this.BASE_URL,
            timeout: this.TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            },
            httpsAgent: proxyAgent
        });
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);

            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent 
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                return 'Unknown';
            }
        } catch (error) {
            this.log(`Error khi kiểm tra IP của proxy: ${error}`);
            return 'Error';
        }
    }

    async getBalanceCoins(dancay, authorization) {
        try {
            const response = await dancay.post('/clicker/sync', {}, {
                headers: {
                    'Authorization': `Bearer ${authorization}`
                }
            });

            if (response.status === 200) {
                return response.data.clickerUser.balanceCoins;
            } else {
                this.log(`Không lấy được thông tin balanceCoins. Status code: ${response.status}`);
                return null;
            }
        } catch (error) {
            this.log(`Error: ${error}`);
            return null;
        }
    }

    async buyUpgrades(dancay, authorization) {
        try {
            const upgradesResponse = await dancay.post('/clicker/upgrades-for-buy', {}, {
                headers: {
                    'Authorization': `Bearer ${authorization}`
                }
            });
    
            if (upgradesResponse.status === 200) {
                const upgrades = upgradesResponse.data.upgradesForBuy;
                let balanceCoins = await this.getBalanceCoins(dancay, authorization);
                let purchased = false;
    
                for (const upgrade of upgrades) {
                    if (upgrade.cooldownSeconds > 0) {
                        this.log(`Thẻ ${upgrade.name} đang trong thời gian cooldown ${upgrade.cooldownSeconds} giây.`);
                        continue; 
                    }
    
                    if (upgrade.isAvailable && !upgrade.isExpired && upgrade.price < this.UPGRADE_DIEUKIEN && upgrade.price <= balanceCoins) {
                        const buyUpgradePayload = {
                            upgradeId: upgrade.id,
                            timestamp: Math.floor(Date.now() / 1000)
                        };
                        try {
                            const response = await dancay.post('/clicker/buy-upgrade', buyUpgradePayload, {
                                headers: {
                                    'Authorization': `Bearer ${authorization}`
                                }
                            });
                            if (response.status === 200) {
                                this.log(`(${Math.floor(balanceCoins)}) Đã nâng cấp thẻ ${upgrade.name}.`);
                                purchased = true;
                                balanceCoins -= upgrade.price; 
                            }
                        } catch (error) {
                            if (error.response && error.response.data) {
                                if (error.response.data.error_code === 'UPGRADE_COOLDOWN') {
                                    this.log(`Thẻ ${upgrade.name} đang trong thời gian cooldown ${error.response.data.cooldownSeconds} giây.`);
                                } else if (error.response.data.error_code === 'UPGRADE_MAX_LEVEL') {
                                    this.log(`${error.response.data.error_message}`);
                                } else {
                                    this.log(`Lỗi khi nâng cấp thẻ ${upgrade.name}: ${error.response.data.error_message}`);
                                }
                            } else {
                                this.log(`Lỗi không xác định khi nâng cấp thẻ ${upgrade.name}: ${error}`);
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000)); 
                    }
                }
    
                if (!purchased) {
                    this.log(`Token ${authorization.substring(0, 10)}... không có thẻ nào khả dụng hoặc đủ điều kiện. Chuyển token tiếp theo...`);
                    return false;
                }
            } else {
                this.log(`Không lấy được danh sách thẻ. Status code: ${upgradesResponse.status}`);
                return false;
            }
        } catch (error) {
            console.log(error);
            this.log('Lỗi không mong muốn, chuyển token tiếp theo');
            return false;
        }
        return true;
    }

    async claimDailyCipher(dancay, authorization, cipher) {
        if (cipher) {
            try {
                const payload = {
                    cipher: cipher
                };
                const response = await dancay.post('/clicker/claim-daily-cipher', payload, {
                    headers: {
                        'Authorization': `Bearer ${authorization}`
                    }
                });

                if (response.status === 200) {
                    this.log(`Đã giải mã morse ${cipher}`);
                } else {
                    this.log(`Không claim được daily cipher. Status code: ${response.status}`);
                }
            } catch (error) {
                this.log(`Đã giải mã morse!`);
            }
        }
    }

    async startAndClaimKeysMinigame(dancay, authorization) {
        try {
            const startResponse = await dancay.post('/clicker/start-keys-minigame', {}, {
                headers: {
                    'Authorization': `Bearer ${authorization}`
                }
            });

            if (startResponse.status === 200) {
                this.log(`Đã bắt đầu keys minigame!`);
            } else {
                this.log(`Không thể bắt đầu keys minigame. Status code: ${startResponse.status}`);
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 20000)); 

            const tokenSuffix = authorization.slice(-10);
            const randomPrefix = '0' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
            const cipher = `${randomPrefix}|${tokenSuffix}`;
            const base64Cipher = Buffer.from(cipher).toString('base64');

            const claimResponse = await dancay.post('/clicker/claim-daily-keys-minigame', { cipher: base64Cipher }, {
                headers: {
                    'Authorization': `Bearer ${authorization}`
                }
            });

            if (claimResponse.status === 200) {
                this.log(`Đã claim daily keys minigame!`);
            } else {
                this.log(`Không thể claim daily keys minigame. Status code: ${claimResponse.status}`);
            }
        } catch (error) {
            this.log(`Đã claim daily keys minigame!`);
        }
    }

    async askForUpgrade() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question('Có nâng cấp thẻ không? (y/n): ', (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'y');
            });
        });
    }

    async askForCipher() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question('Mã morse hôm nay cần giải: ', (answer) => {
                rl.close();
                resolve(answer.trim().toUpperCase());
            });
        });
    }

    async askForPromo() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question('Có nhập code lấy key không? (y/n): ', (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'y');
            });
        });
    }
	
	async getPromoCodes() {
		try {
			const data = fs.readFileSync(this.promoCodeFile, 'utf8');
			const lines = data.split('\n').map(line => line.trim()).filter(line => line !== '');
			const promoCodes = {
				ZOO: [],
				TRAIN: [],
				CUBE: [],
                MERGE: [],
                TWERK: [],
                POLY: [],
                TRIM: [],
                GANGS: [],
                CAFE: []
			};
			lines.forEach(line => {
				const type = line.split('-')[0];
				if (promoCodes[type]) {
					promoCodes[type].push(line);
				}
			});

			return promoCodes;
		} catch (error) {
			this.log(`Error khi đọc mã khuyến mãi từ file: ${error}`);
			return {};
		}
	}

    async selectCodes(promoCodes) {
        const selectedCodes = {};
        const usedCodes = await this.loadUsedCodes();
    
        for (const type in promoCodes) {
            if (promoCodes[type].length > 0) {
                const codes = promoCodes[type].filter(code => !usedCodes.has(code));
                selectedCodes[type] = codes;
            }
        }
    
        return selectedCodes;
    }

    async checkPromoCodes(promoCodes, requiredCount = 5) {
        const validCodes = {};
        for (const [type, codes] of Object.entries(promoCodes)) {
            this.log(`Số lượng mã ${type}: ${codes.length}`);
            if (codes.length >= requiredCount) {
                validCodes[type] = codes;
            } else {
                this.log(`Số lượng mã ${type} không đủ ${requiredCount}. Có ${codes.length} mã. Bỏ qua loại mã này.`);
            }
        }
        return validCodes;
    }

	async updatePromoCodeFile(promoCodes) {
		const allCodes = [].concat(...Object.values(promoCodes));
		fs.writeFileSync(this.promoCodeFile, allCodes.join('\n'));
	}

    async loadUsedCodes() {
        try {
            const data = await fs.promises.readFile('used_codes.txt', 'utf8');
            return new Set(data.split('\n').filter(code => code.trim() !== ''));
        } catch (error) {
            if (error.code === 'ENOENT') {
                return new Set();
            }
            throw error;
        }
    }
    
    async saveUsedCode(code) {
        await fs.promises.appendFile('used_codes.txt', code + '\n');
    }

    async redeemPromoCodes(dancay, authorization, codes) {
        const successfulCodes = { ZOO: [], TRAIN: [], CUBE: [], MERGE: [], TWERK: [], POLY: [], TRIM: [], GANGS: [], CAFE: [] };
        let totalSuccessful = 0;
        
        for (const type of Object.keys(successfulCodes)) {
            if (!codes[type] || !Array.isArray(codes[type])) {
                continue; 
            }

            let count = 0;
            for (const code of codes[type]) {
                if (totalSuccessful >= 36 || count >= 4) break; 
        
                try {
                    const payload = { promoCode: code };
                    const response = await dancay.post('/clicker/apply-promo', payload, {
                        headers: { 'Authorization': `Bearer ${authorization}` }
                    });
        
                    if (response.status === 200) {
                        this.log(`Đã nhập mã khuyến mãi loại ${type} (${code}) thành công`);
                        successfulCodes[type].push(code);
                        await this.saveUsedCode(code);
                        totalSuccessful++;
                        count++;
                        
                        await this.removeSuccessfulCode(type, code);
                    } else {
                        if (response.status === 400) {
                            await this.removeInvalidCode(type, code);
                        }
                    }
                } catch (error) {                    
                    if (error.response && error.response.data && error.response.data.error_code === 'MaxKeysReceived') {
                        this.log("Đã nhập tối đa key ngày hôm nay!");
                        return;
                    }
                }
        
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
        }
        
        this.log(`Đã nhập thành công ${totalSuccessful} mã khuyến mãi.`);
    }  

	async removeInvalidCode(type, code) {
		try {
			const data = fs.readFileSync(this.promoCodeFile, 'utf8');
			const lines = data.split('\n').map(line => line.trim()).filter(line => line !== '');
			const updatedLines = lines.filter(line => line !== code);
			fs.writeFileSync(this.promoCodeFile, updatedLines.join('\n'));
			this.log(`Đã xóa mã lỗi ${code} khỏi file`);
		} catch (error) {
			this.log(`Error khi xóa mã lỗi khỏi file: ${error}`);
		}
	}

    async removeSuccessfulCode(type, code) {
        try {
            const data = await fs.promises.readFile(this.promoCodeFile, 'utf8');
            const lines = data.split('\n').map(line => line.trim()).filter(line => line !== '');
            const updatedLines = lines.filter(line => line !== code);
            await fs.promises.writeFile(this.promoCodeFile, updatedLines.join('\n'));
            this.log(`Đã xóa mã đã sử dụng ${code} khỏi file`);
        } catch (error) {
            this.log(`Error khi xóa mã đã sử dụng khỏi file: ${error}`);
        }
    }

    async main() {
        const shouldUpgrade = await this.askForUpgrade(); 
        const cipher = await this.askForCipher();
        const promo = await this.askForPromo();
        while (true) {
            for (let i = 0; i < this.authorizationList.length; i++) {
                const authorization = this.authorizationList[i];
                const proxy = this.proxyList[i % this.proxyList.length];
                const ip = await this.checkProxyIP(proxy);
                console.log(`========== Tài khoản ${i + 1} | ip: ${ip} ==========`);
                
                const dancay = this.createAxiosInstance(proxy);
        
                await this.claimDailyCipher(dancay, authorization, cipher);
                await this.startAndClaimKeysMinigame(dancay, authorization);
                
                if (promo) {
                    try {
                        const promoCodes = await this.getPromoCodes();
                        const validCodes = await this.checkPromoCodes(promoCodes);
                        if (Object.keys(validCodes).length > 0) {
                            const selectedCodes = await this.selectCodes(validCodes);
                            await this.redeemPromoCodes(dancay, authorization, selectedCodes);
                        } else {
                            this.log('Không có mã khuyến mãi nào đủ số lượng để nhập.');
                        }
                    } catch (error) {
                        this.log(`Error khi xử lý mã khuyến mãi: ${error}`);
                    }
                }
        
                if (shouldUpgrade) {
                    while (true) {
                        const success = await this.buyUpgrades(dancay, authorization);
                        if (!success) {
                            break;
                        }
                    }
                }
            }
            this.log('Đã chạy xong tất cả các token.');
            this.log('Chờ 30 giây trước khi tiếp tục...');
            await new Promise(resolve => setTimeout(resolve, 30000)); 
        }
    }
}

const game = new HamsterKombatGame();
game.main().catch(error => game.log(`Error in main: ${error}`));