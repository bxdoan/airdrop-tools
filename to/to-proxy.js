const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const colors = require('colors');
const { parse } = require('querystring');
const { DateTime } = require('luxon');
const { HttpsProxyAgent } = require('https-proxy-agent');

class Tomarket {
    constructor() {
        this.wallets = this.loadWallets('./../data/wallet.txt');
        this.headers = {
            'host': 'api-web.tomarket.ai',
            'connection': 'keep-alive',
            'accept': 'application/json, text/plain, */*',
            'user-agent': "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
            'content-type': 'application/json',
            'origin': 'https://mini-app.tomarket.ai',
            'x-requested-with': 'tw.nekomimi.nekogram',
            'sec-fetch-site': 'same-site',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'referer': 'https://mini-app.tomarket.ai/',
            'accept-language': 'en-US,en;q=0.9'
        };

        this.interval = 3;
        this.playGame = true;
        this.gameLowPoint = 300;
        this.gameHighPoint = 450;
        this.proxies = this.loadProxies('./../data/proxy.txt');
    }

    setAuthorization(auth) {
        this.headers['authorization'] = auth;
    }

    delAuthorization() {
        delete this.headers['authorization'];
    }

    loadProxies(file) {
        const proxies = fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (proxies.length <= 0) {
            console.log(colors.red(`Không tìm thấy proxy`));
            process.exit();
        }
        return proxies;
    }

    async login(data, proxy) {
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/user/login';
        const cleanedData = data.replace(/\r/g, '');
        const requestData = {
            init_data: cleanedData,
            invite_code: ''
        };
        
        this.delAuthorization();
        try {
            const res = await this.http(url, this.headers, JSON.stringify(requestData), proxy);
            if (res.status !== 200) {
                this.log(colors.red(`Login không thành công! Mã trạng thái: ${res.status}`));
                return null;
            }
            const token = res.data.data.access_token;
            this.log(colors.green(`Đăng nhập thành công!`));
            return token;
        } catch (error) {
            this.log(colors.red(`Lỗi trong quá trình đăng nhập: ${error.message}`));
            return null;
        }
    }

    async startFarming(proxy) {
        const data = JSON.stringify({ game_id: '53b22103-c7ff-413d-bc63-20f6fb806a07' });
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/farm/start';
        const res = await this.http(url, this.headers, data, proxy);
        if (res.status !== 200) {
            this.log(colors.red('Không thể bắt đầu farming!'));
            return false;
        }
        const endFarming = res.data.data.end_at;
        const formatEndFarming = DateTime.fromMillis(endFarming).toISO().split('.')[0];
        this.log(colors.green('Bắt đầu farming...'));
    }

    async endFarming(proxy) {
        const data = JSON.stringify({ game_id: '53b22103-c7ff-413d-bc63-20f6fb806a07' });
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/farm/claim';
        const res = await this.http(url, this.headers, data, proxy);
        if (res.status !== 200) {
            this.log(colors.red('Không thể thu hoạch cà chua!'));
            return false;
        }
        const poin = res.data.data.claim_this_time;
        this.log(colors.green('Đã thu hoạch cà chua'));
        this.log(colors.green('Phần thưởng : ') + colors.white(poin));
    }

    async dailyClaim(proxy) {
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/daily/claim';
        const data = JSON.stringify({ game_id: 'fa873d13-d831-4d6f-8aee-9cff7a1d0db1' });
        const res = await this.http(url, this.headers, data, proxy);
        if (res.status !== 200) {
            this.log(colors.red('Không thể điểm danh hàng ngày!'));
            return false;
        }

        const responseData = res.data.data;
        if (typeof responseData === 'string') {
            return false;
        }

        const poin = responseData.today_points;
        this.log(colors.green('Điểm danh hàng ngày thành công, phần thưởng: ') + colors.white(poin));
        return true;
    }

    async playGameFunc(amountPass, proxy) {
        const dataGame = JSON.stringify({ game_id: '59bcd12e-04e2-404c-a172-311a0084587d' });
        const startUrl = 'https://api-web.tomarket.ai/tomarket-game/v1/game/play';
        const claimUrl = 'https://api-web.tomarket.ai/tomarket-game/v1/game/claim';
        for (let i = 0; i < amountPass; i++) {
            const res = await this.http(startUrl, this.headers, dataGame, proxy);
            if (res.status !== 200) {
                this.log(colors.red('Không thể bắt đầu trò chơi'));
                return;
            }
            this.log(colors.green('Bắt đầu chơi game...'));
            await this.countdown(30);
            const point = this.randomInt(this.gameLowPoint, this.gameHighPoint);
            const dataClaim = JSON.stringify({ game_id: '59bcd12e-04e2-404c-a172-311a0084587d', points: point });
            const resClaim = await this.http(claimUrl, this.headers, dataClaim, proxy);
            if (resClaim.status !== 200) {
                this.log(colors.red('Lỗi nhận cà chua trong trò chơi'));
                continue;
            }
            this.log(colors.green('Nhận được cà chua : ') + colors.white(point));
        }
    }

    async getBalance(proxy) {
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/user/balance';
        while (true) {
            const res = await this.http(url, this.headers, '', proxy);
            const data = res.data.data;
            if (!data) {
                this.log(colors.red('Lấy dữ liệu thất bại'));
                return null;
            }

            const timestamp = data.timestamp;
            const balance = data.available_balance;
            this.log(colors.green('Balance : ') + colors.white(balance));

            if (!data.daily) {
                await this.dailyClaim(proxy);
                continue;
            }

            const lastCheckTs = data.daily.last_check_ts;
            if (DateTime.now().toSeconds() > lastCheckTs + 24 * 60 * 60) {
                await this.dailyClaim(proxy);
            }

            if (!data.farming) {
                this.log(colors.yellow('Farming chưa bắt đầu'));
                await this.startFarming(proxy);
                continue;
            }

            const endFarming = data.farming.end_at;
            const formatEndFarming = DateTime.fromMillis(endFarming * 1000).toISO().split('.')[0];
            if (timestamp > endFarming) {
                await this.endFarming(proxy);
                continue;
            }

            this.log(colors.yellow('Thời gian hoàn thành farming: ') + colors.white(formatEndFarming));

            if (this.playGame) {
                const playPass = data.play_passes;
                this.log(colors.green('Vé trò chơi: ') + colors.white(playPass));
                if (parseInt(playPass) > 0) {
                    await this.playGameFunc(playPass, proxy);
                    continue;
                }
            }

            const next = endFarming - timestamp;
            return next;
        }
    }

    loadData(file) {
        const datas = fs.readFileSync(file, 'utf8').split('\n');
        if (datas.length <= 0) {
            console.log(colors.red(`Không tìm thấy dữ liệu`));
            process.exit();
        }
        return datas;
    }

    createTokenFile(token_fp) {
        // if token.json not exists, create it
        if (!fs.existsSync(token_fp)) {
            fs.writeFileSync(token_fp, '');
            fs.appendFile(token_fp, '{}', (err) => {
                if (err) {
                    this.log(`Lỗi khi lưu item vào file: ${err.message}`, 'red');
                }
            });
        }
    }

    save(id, token) {
        this.createTokenFile('./../data/token.json');
        const tokens = JSON.parse(fs.readFileSync('./../data/token.json', 'utf8'));
        tokens[id] = token;
        fs.writeFileSync('./../data/token.json', JSON.stringify(tokens, null, 4));
    }

    get(id) {
        this.createTokenFile('./../data/token.json');
        const tokens = JSON.parse(fs.readFileSync('./../data/token.json', 'utf8'));
        return tokens[id] || null;
    }

    isExpired(token) {
        const [header, payload, sign] = token.split('.');
        const decodedPayload = Buffer.from(payload, 'base64').toString();
        const parsedPayload = JSON.parse(decodedPayload);
        const now = Math.floor(DateTime.now().toSeconds());
        return now > parsedPayload.exp;
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

    async http(url, headers, data = null, proxy = null) {
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                const now = DateTime.now().toISO().split('.')[0];
                let res;
                if (!data) {
                    res = await axios.get(url, { headers, httpsAgent: new HttpsProxyAgent(proxy) });
                } else if (data === '') {
                    res = await axios.post(url, null, { headers, httpsAgent: new HttpsProxyAgent(proxy) });
                } else {
                    res = await axios.post(url, data, { headers, httpsAgent: new HttpsProxyAgent(proxy) });
                }
                return res;
            } catch (error) {
                console.log(colors.red('Lỗi kết nối'));
                retryCount++;
                if (retryCount < maxRetries) {
                    await this.countdown(1);
                } else {
                    throw new Error('Kết nối thất bại sau 3 lần thử');
                }
            }
        }
    }

    async countdown(t) {
        for (let i = t; i > 0; i--) {
            const hours = String(Math.floor(i / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((i % 3600) / 60)).padStart(2, '0');
            const seconds = String(i % 60).padStart(2, '0');
            process.stdout.write(colors.white(`[*] Cần chờ ${hours}:${minutes}:${seconds}     \r`));
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        process.stdout.write('                                        \r');
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
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
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    loadWallets(file) {
        const wallets = fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (wallets.length <= 0) {
            console.log(colors.red(`Không tìm thấy ví`));
            process.exit();
        }
        return wallets;
    }

	async submitWalletAddress(accountIndex, proxy) {
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/tasks/address';
        const walletAddress = this.wallets[accountIndex];
        if (!walletAddress) {
            this.log(colors.red(`Không tìm thấy địa chỉ ví cho tài khoản ${accountIndex + 1}`));
            return false;
        }

        const data = JSON.stringify({ wallet_address: walletAddress });

        const maxRetries = 5;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                const res = await this.http(url, this.headers, data, proxy);
                
                if (res.status === 200 && res.data.status === 0 && res.data.data === 'ok') {
                    this.log(colors.green(`Liên kết ví thành công cho tài khoản ${accountIndex + 1}`));
                    return true;
                } else if (res.status === 200 && res.data.message === 'System error please wait') {
                    this.log(colors.yellow(`Lỗi hệ thống, thử lại lần ${retries + 1} cho tài khoản ${accountIndex + 1}`));
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                } else if (res.status === 500) {
                    if (res.data.message === 'Verification failed, Ton address is not from Bitget Wallet') {
                        this.log(colors.red(`Ví ton không được tạo từ bitget wallet cho tài khoản ${accountIndex + 1}`));
                        return false;
                    }
                }

                this.log(colors.red(`Gửi địa chỉ ví không thành công cho tài khoản ${accountIndex + 1}! Mã trạng thái: ${res.status}, Thông báo: ${res.data.message}`));
                return false;
            } catch (error) {
                this.log(colors.red(`Lỗi khi gửi địa chỉ ví cho tài khoản ${accountIndex + 1}: ${error.message}`));
                retries++;
                if (retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    return false;
                }
            }
        }

        this.log(colors.red(`Đã thử gửi địa chỉ ví ${maxRetries} lần không thành công cho tài khoản ${accountIndex + 1}`));
        return false;
    }
    
    async checkWalletTask(proxy) {
        const url = 'https://api-web.tomarket.ai/tomarket-game/v1/tasks/walletTask';
        try {
            const res = await this.http(url, this.headers, '{}', proxy);
            if (res.status === 200 && res.data.status === 0) {
                return res.data.data.walletAddress;
            }
            return null;
        } catch (error) {
            this.log(colors.red(`Lỗi khi kiểm tra wallet task: ${error.message}`));
            return null;
        }
    }

	async checkRank(proxy) {
		const rankDataUrl = 'https://api-web.tomarket.ai/tomarket-game/v1/rank/data';
		const evaluateUrl = 'https://api-web.tomarket.ai/tomarket-game/v1/rank/evaluate';
		const createRankUrl = 'https://api-web.tomarket.ai/tomarket-game/v1/rank/create';

		try {
			const rankDataRes = await this.http(rankDataUrl, this.headers, '{}', proxy);
			if (rankDataRes.status === 200 && rankDataRes.data.status === 0) {
				if (rankDataRes.data.data.isCreated) {
					const currentRank = rankDataRes.data.data.currentRank;
					this.log(colors.green(`Rank hiện tại: ${currentRank.name}`));
					return;
				}
			}

			const evaluateRes = await this.http(evaluateUrl, this.headers, '{}', proxy);
			if (evaluateRes.status === 200 && evaluateRes.data.status === 0) {
				const { stars } = evaluateRes.data.data;
				this.log(colors.yellow(`Kiểm tra tài khoản... số sao: ${stars}`));
			}

			const createRankRes = await this.http(createRankUrl, this.headers, '{}', proxy);
			if (createRankRes.status === 200 && createRankRes.data.status === 0) {
				const currentRank = createRankRes.data.data.currentRank;
				this.log(colors.green(`Kiểm tra rank thành công, rank hiện tại: ${currentRank.name}`));
			}
		} catch (error) {
			this.log(colors.red(`Lỗi khi kiểm tra rank: ${error.message}`));
		}
	}

	async getTasks(proxy) {
		const url = 'https://api-web.tomarket.ai/tomarket-game/v1/tasks/list';
		const data = JSON.stringify({ language_code: 'en' });
		try {
			const res = await this.http(url, this.headers, data, proxy);
			if (res.status === 200 && res.data.status === 0) {
				return res.data.data;
			}
			return null;
		} catch (error) {
			this.log(colors.red(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`));
			return null;
		}
	}

	async startTask(taskId, initData, proxy, maxRetries = 5) {
		const url = 'https://api-web.tomarket.ai/tomarket-game/v1/tasks/start';
		const data = JSON.stringify({ task_id: taskId, init_data: initData });
		
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const res = await this.http(url, this.headers, data, proxy);
				
				if (res.status === 200 && res.data.status === 0) {
					if (res.data.data.status === 1) {
						return true;
					} else if (res.data.data.status === 3) {
						return 'completed';
					}
				}
				
				if (res.data.code === 400 && res.data.message === "claim throttle") {
					this.log(colors.yellow(`Gặp lỗi cho nhiệm vụ ${taskId}. thử lại ${attempt}/${maxRetries}`));
					
					if (attempt < maxRetries) {
						const waitTime = 5;
						this.log(colors.blue(`Chờ ${waitTime} giây trước khi thử lại...`));
						await this.countdown(waitTime);
					} else {
						this.log(colors.red(`Đã thử ${maxRetries} lần nhưng vẫn gặp lỗi cho nhiệm vụ ${taskId}`));
						return false;
					}
				} else {
					return false;
				}
			} catch (error) {
				this.log(colors.red(`Lỗi khi bắt đầu nhiệm vụ ${taskId} (lần thử ${attempt}/${maxRetries}):`));
				
				if (attempt < maxRetries) {
					const waitTime = 5;
					this.log(colors.blue(`Chờ ${waitTime} giây trước khi thử lại...`));
					await this.countdown(waitTime);
				} else {
					return false;
				}
			}
		}
		
		return false;
	}

	async claimTask(taskId, proxy) {
		const url = 'https://api-web.tomarket.ai/tomarket-game/v1/tasks/claim';
		const data = JSON.stringify({ task_id: taskId });
		try {
			const res = await this.http(url, this.headers, data, proxy);
			if (res.status !== 200 || res.data.status !== 0) {
				return false;
			}
			return true;
		} catch (error) {
			this.log(colors.red(`Lỗi khi nhận thưởng nhiệm vụ ${taskId}:`));
			return false;
		}
	}

	async checkTaskStatus(taskId, initData, proxy) {
		const url = 'https://api-web.tomarket.ai/tomarket-game/v1/tasks/check';
		const data = JSON.stringify({ task_id: taskId, init_data: initData });
		try {
			const res = await this.http(url, this.headers, data, proxy);
			if (res.status === 200 && res.data.status === 0) {
				return res.data.data.status;
			} else {
				this.log(colors.yellow(`Không thể kiểm tra trạng thái nhiệm vụ ${taskId}. Response:`, JSON.stringify(res.data, null, 2)));
				return null;
			}
		} catch (error) {
			this.log(colors.red(`Lỗi khi kiểm tra trạng thái nhiệm vụ ${taskId}:`));
			return null;
		}
	}

	async processTasks(tasks, type, initData, proxy, maxRetries = 5) {
		const tasksToProcess = tasks.filter(task => type === 'default' ? task.status === 0 : true);
		let allTasksCompleted = true;

		for (const task of tasksToProcess) {
			if (type !== 'default') {
				const startResult = await this.startTask(task.taskId, initData, proxy, maxRetries);
				if (startResult === true) {
					this.log(colors.green(`Bắt đầu nhiệm vụ ${task.taskId}: ${task.title} thành công`));
					allTasksCompleted = false;
				} else if (startResult === 'completed') {
					this.log(colors.blue(`Nhiệm vụ ${task.taskId}: ${task.title} đã được làm`));
				} else {
					this.log(colors.yellow(`Không thể bắt đầu nhiệm vụ ${task.taskId}: ${task.title} sau ${maxRetries} lần thử`));
					allTasksCompleted = false;
				}
			}
			await this.countdown(3);
		}

		if (type !== 'default') {
			if (!allTasksCompleted) {
				this.log(colors.blue('Chờ 31 giây trước khi kiểm tra trạng thái nhiệm vụ...'));
				await this.countdown(31);
			} else {
				this.log(colors.green('Tất cả các nhiệm vụ đã được hoàn thành.'));
			}

			for (const task of tasksToProcess) {
				const status = await this.checkTaskStatus(task.taskId, initData, proxy);
				if (status === 2) {
					const claimed = await this.claimTask(task.taskId, proxy);
					if (claimed) {
						this.log(colors.green(`Nhận thưởng nhiệm vụ ${task.taskId}: ${task.title} thành công | phần thưởng: ${task.score}`));
					} else {
						this.log(colors.yellow(`Không thể nhận thưởng nhiệm vụ ${task.taskId}: ${task.title}`));
					}
				} else if (status === 3) {
					this.log(colors.blue(`Nhiệm vụ ${task.taskId}: ${task.title} đã hoàn thành`));
				} else {
					this.log(colors.yellow(`Nhiệm vụ ${task.taskId}: ${task.title} chưa hoàn thành (status: ${status})`));
				}
				await this.countdown(3);
			}
		} else {
			for (const task of tasksToProcess) {
				const claimed = await this.claimTask(task.taskId, proxy);
				if (claimed) {
					this.log(colors.green(`Nhận thưởng combo thành công: ${task.title}`));
				} else {
					this.log(colors.yellow(`Không thể nhận thưởng nhiệm vụ ${task.taskId}: ${task.title}`));
				}
				await this.countdown(3);
			}
		}
	}

	async manageTasks(initData, proxy) {
		const tasks = await this.getTasks(proxy);
		if (!tasks) return;

		const taskTypes = ['standard', 'expire', 'default'];
		for (const type of taskTypes) {
			if (tasks[type]) {
				await this.processTasks(tasks[type], type, initData, proxy);
			}
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
	
    async main() {
        const dataFile = './../data/to.txt';
        const marinkitagawa = false;
        if (!marinkitagawa) {
            console.clear();
        }
        const datas = this.loadData(dataFile);
		
		this.log('Tool được chia sẻ tại kênh telegram VP Airdrop (@vp_airdrop)'.green);
        
        const nhiemvu = await this.askQuestion('Bạn có muốn làm nhiệm vụ không? (y/n): ');
        const hoinhiemvu = nhiemvu.toLowerCase() === 'y';
		
		const lienkietvi = await this.askQuestion('Bạn có muốn liên kết ví không? (y/n): ');
        const hoilkvi = lienkietvi.toLowerCase() === 'y';
		
        while (true) {
            const listCountdown = [];
            const start = Math.floor(Date.now() / 1000);

            for (let i = 0; i < datas.length; i++) {
                try {
                    const result = await this.processAccount(datas[i], i, hoinhiemvu, hoilkvi);
                    if (result !== null) {
                        listCountdown.push(result);
                    }
                } catch (error) {
                    console.error(colors.red(`Error processing account ${i + 1}: ${error.message}`));
                    continue;
                }
                await this.countdown(this.interval);
            }

            const end = Math.floor(Date.now() / 1000);
            const total = end - start;
            const min = Math.min(...listCountdown) - total;
            if (min > 0) {
                await this.countdown(min);
            }
        }
    }

    async processAccount(data, index, hoinhiemvu, hoilkvi) {
        const parser = parse(data);
        const user = JSON.parse(parser.user);
        const id = user.id;
        const username = user.first_name;
        const proxy = this.formatProxy(this.proxies[index % this.proxies.length]);
        
        let proxyIP = await this.getProxyIP(proxy);
        console.log(`========== Tài khoản ${index + 1} | ${username.green} | IP: ${proxyIP} ==========`);

        const token = await this.getOrRefreshToken(id, data, proxy);
        if (!token) return null;

        this.setAuthorization(token);
		if (hoilkvi) {
			await this.handleWalletTask(index, proxy);
		}
        await this.checkRank(proxy);
		if (hoinhiemvu) {
		await this.manageTasks(data, proxy);
		}
        return await this.getBalance(proxy);
    }

    async getProxyIP(proxy) {
        try {
            return await this.checkProxyIP(proxy);
        } catch (error) {
            return 'Unknown';
        }
    }

    async getOrRefreshToken(id, data, proxy) {
        let token = this.get(id);
        if (!token || this.isExpired(token)) {
            try {
                token = await this.login(data, proxy);
                if (token) this.save(id, token);
            } catch (error) {
                console.error(colors.red(`Đăng nhập thất bại: ${error.message}`));
                return null;
            }
        }
        return token;
    }

    async handleWalletTask(accountIndex, proxy) {
        try {
            const existingWalletAddress = await this.checkWalletTask(proxy);
            if (!existingWalletAddress) {
                const walletSubmitted = await this.submitWalletAddress(accountIndex, proxy);
                if (!walletSubmitted) {
                    this.log(colors.yellow(`Không thể gửi địa chỉ ví cho tài khoản ${accountIndex + 1}. Tiếp tục với các tác vụ khác.`));
                }
            } else {
                this.log(colors.green(`Địa chỉ ví đã tồn tại cho tài khoản ${accountIndex + 1}: ${existingWalletAddress}`));
            }
        } catch (error) {
            this.log(colors.red(`Lỗi khi xử lý wallet task cho tài khoản ${accountIndex + 1}: ${error.message}`));
        }
    }
}

(async () => {
    try {
        const app = new Tomarket();
        await app.main();
    } catch (error) {
        console.error(error);
        process.exit();
    }
})();