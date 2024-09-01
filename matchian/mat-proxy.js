const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');
const { parse } = require('querystring');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const colors = require('colors');
const { DateTime } = require('luxon');

const headers = {
    "host": "tgapp-api.matchain.io",
    "connection": "keep-alive",
    "accept": "application/json, text/plain, */*",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; Redmi 4A / 5A Build/QQ3A.200805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.185 Mobile Safari/537.36",
    "content-type": "application/json",
    "origin": "https://tgapp.matchain.io",
    "x-requested-with": "tw.nekomimi.nekogram",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "referer": "https://tgapp.matchain.io/",
    "accept-language": "en,en-US;q=0.9"
};

class Matchain {
    constructor(proxies) {
        this.headers = { ...headers };
        this.proxies = proxies;
        this.autogame = true;
    }

    async http(url, headers, data = null, proxy) {
        const agent = proxy ? new HttpsProxyAgent(proxy) : null;
        const config = {
            headers,
            httpsAgent: agent,
        };
        while (true) {
            try {
                const res = data ? await axios.post(url, data, config) : await axios.get(url, config);
                return res;
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    log(msg, level = 'info') {
        const levels = {
            info: 'cyan',
            success: 'green',
            warning: 'yellow',
            error: 'red'
        };
        console.log(`[*] ${msg}`[levels[level]]);
    }

    dancay(data) {
        const params = new URLSearchParams(data);
        const parsedData = {};
        for (const [key, value] of params.entries()) {
            parsedData[key] = value;
        }
        return parsedData;
    }

	async completeQuiz() {
		try {
			const quizUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/daily/quiz/progress";
			let quizRes = await this.http(quizUrl, this.headers, null, this.proxy);
			if (quizRes.status !== 200) {
				this.log('Lỗi khi lấy câu hỏi quiz!', 'error');
				return false;
			}

			const quizData = quizRes.data.data;
			const answerResult = [];

			for (const question of quizData) {
				const correctAnswer = question.items.find(item => item.is_correct);
				if (correctAnswer) {
					answerResult.push({
						quiz_id: question.Id,
						selected_item: correctAnswer.number,
						correct_item: correctAnswer.number
					});
				}
			}

			const submitUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/daily/quiz/submit";
			const payload = JSON.stringify({ answer_result: answerResult });
			let submitRes = await this.http(submitUrl, this.headers, payload, this.proxy);

			if (submitRes.status === 200 && submitRes.data.code === 200) {
				this.log('Trả lời câu hỏi quiz thành công!', 'success');
				return true;
			} else {
				this.log('Lỗi khi gửi câu trả lời quiz!', 'error');
				return false;
			}
		} catch (error) {
			this.log(`Hôm nay bạn đã trả lời câu hỏi rồi!`, 'error');
			return false;
		}
	}
	
    async login(data, proxy) {
        const parser = this.dancay(data);
        const userEncoded = decodeURIComponent(parser['user']);
        let user;
        try {
            user = JSON.parse(userEncoded);
        } catch (error) {
            this.log('Không thể phân tích JSON', 'error');
            return false;
        }
    
        const url = "https://tgapp-api.matchain.io/api/tgapp/v1/user/login";
        const payload = JSON.stringify({
            "uid": user['id'],
            "first_name": user['first_name'],
            "last_name": user['last_name'],
            "username": user['username'],
            "tg_login_params": data
        });
    
        let res = await this.http(url, this.headers, payload, proxy);
        if (res.status !== 200) {
            this.log(`Đăng nhập không thành công! Status: ${res.status}`, 'error');
            return false;
        }
    
        if (!res.data || !res.data.data || !res.data.data.token) {
            this.log('Không tìm thấy token!', 'error');
            return false;
        }
    
        this.userid = user['id'];
        this.log('Đăng nhập thành công!', 'success');
        const token = res.data.data.token;
        this.headers['authorization'] = token;
    
        const balanceUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/point/balance";
        res = await this.http(balanceUrl, this.headers, JSON.stringify({ "uid": this.userid }), proxy);
        if (res.status !== 200) {
            this.log('Lỗi không lấy được balance!', 'error');
            return false;
        }
    
        const balance = res.data.data;
        this.log(`Balance: ${balance / 1000}`, 'info');
		
		const quizResult = await this.completeQuiz();
        if (quizResult) {
            this.log('Hoàn thành quiz hàng ngày', 'success');
        } else {
            this.log('Không thể hoàn thành quiz hàng ngày', 'warning');
        }
		
		const taskStatus = await this.checkDailyTaskStatus();
		if (taskStatus) {
			if (taskStatus.dailyNeedsPurchase) {
				try {
					const boosterResult = await this.buyBooster(token, this.userid);
					if (boosterResult.code === 400) {
						this.log('Bạn đã thực hiện mua booster trước đó, thử lại sau!', 'warning');
					} else if (boosterResult) {
						this.log('Mua thành công Daily Booster', 'success');
					}
				} catch (error) {
					console.error('Error buying booster:', error);
					this.log('Lỗi khi mua Daily Booster', 'error');
				}
			}
		}
		
        let next_claim = 0;
        while (true) {
            const rewardUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/point/reward";
            res = await this.http(rewardUrl, this.headers, JSON.stringify({ "uid": this.userid }), proxy);
            if (res.status !== 200) {
                this.log('Error, check response!', 'error');
                return false;
            }
    
            next_claim = res.data.data.next_claim_timestamp;
            if (next_claim === 0) {
                const farmingUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/point/reward/farming";
                res = await this.http(farmingUrl, this.headers, JSON.stringify({ "uid": this.userid }), proxy);
                if (res.status !== 200) {
                    this.log('Error, check response!', 'error');
                    return false;
                }
                continue;
            }
    
            if (next_claim > Date.now()) {
                const format_next_claim = DateTime.fromMillis(next_claim).toFormat('yyyy-MM-dd HH:mm:ss');
                this.log('Đang trong trạng thái farming!', 'warning');
                this.log(`Thời gian hoàn thành farming: ${format_next_claim}`, 'info');
                break; 
            }
    
            const claimUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/point/reward/claim";
            res = await this.http(claimUrl, this.headers, JSON.stringify({ "uid": this.userid }), proxy);
            if (res.status !== 200) {
                this.log('Nhận phần thưởng thất bại!', 'error');
                return false;
            }
    
            const _data = res.data.data;
            this.log('Phần thưởng đã được nhận thành công', 'success');
            this.log(`Balance: ${balance + _data}`, 'info');
        }
    
        const taskNames = await this.getTaskList(user['id'], proxy);
        for (let taskType of taskNames) {
            await this.completeTask(user['id'], taskType, proxy);
        }
    
		const updatedTaskStatus = await this.checkDailyTaskStatus();
		if (updatedTaskStatus && updatedTaskStatus.gameNeedsPurchase) {
			const ticketResult = await this.buyTicket(token, this.userid);
			if (ticketResult) {
				this.log('Mua thành công Game Ticket', 'success');
			}
		}
	
		const gameRuleUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/game/rule";
		let gameRuleRes = await this.http(gameRuleUrl, this.headers, null, proxy);
		if (gameRuleRes.status !== 200) {
			this.log('Lỗi khi lấy thông tin trò chơi!', 'error');
			return false;
		}

		let gameCount = gameRuleRes.data.data.game_count;
		this.log(`Số lượt chơi còn lại: ${gameCount}`, 'info');

		const gameUrl = "https://tgapp-api.matchain.io/api/tgapp/v1/game/play";
		while (gameCount > 0) {
			let res = await this.http(gameUrl, this.headers, null, proxy);
			if (res.status !== 200) {
				this.log('Lỗi bắt đầu trò chơi!', 'error');
				return false;
			}

			const game_id = res.data.data.game_id;
			this.log(`Bắt đầu trò chơi ID: ${game_id}`, 'info');

			await this.countdown(30);
			const point = Math.floor(Math.random() * (150 - 100 + 1)) + 100;
			const payload = JSON.stringify({ "game_id": game_id, "point": point });
			const url_claim = "https://tgapp-api.matchain.io/api/tgapp/v1/game/claim";
			res = await this.http(url_claim, this.headers, payload, proxy);
			if (res.status !== 200) {
				this.log('Không thể kết thúc trò chơi!', 'error');
				continue;
			}

			this.log(`Hoàn thành trò chơi, kiếm được: ${point}`, 'success');
			gameCount--;
			this.log(`Số lượt chơi còn lại: ${gameCount}`, 'info');
		}

		this.log('Đã hết lượt chơi!', 'warning');

		return Math.round(next_claim / 1000 - Date.now() / 1000) + 30;
	}
    

    load_data(file) {
        const data = fs.readFileSync(file, 'utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

        if (data.length === 0) {
            this.log('Không tìm thấy tài khoản nào!', 'warning');
            return false;
        }

        return data;
    }

    load_proxies(file) {
        const proxies = fs.readFileSync(file, 'utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

        if (proxies.length === 0) {
            this.log('Không tìm thấy proxy nào!', 'warning');
            return false;
        }

        return proxies;
    }

    async getTaskList(uid, proxy) {
        const url = "https://tgapp-api.matchain.io/api/tgapp/v1/point/task/list";
        const payload = JSON.stringify({ "uid": uid });

        let res = await this.http(url, this.headers, payload, proxy);
        if (res.status !== 200) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ! Status: ${res.status}`, 'error');
            return false;
        }

        const data = res.data.data;

        if (!data || !Array.isArray(data.Tasks)) {
            this.log('Dữ liệu không hợp lệ', 'error');
            return false;
        }

		const extraTasks = Array.isArray(data['Extra Tasks']) ? data['Extra Tasks'] : [];
		const allTasks = [...data.Tasks, ...extraTasks];
		const filteredTasks = allTasks.filter(task => task.complete === false && task.name !== "join_match_group");
		const taskNames = filteredTasks.map(task => task.name);
		return taskNames;
    }

    async completeTask(uid, taskType, proxy) {
        const url = "https://tgapp-api.matchain.io/api/tgapp/v1/point/task/complete";
        const payload = JSON.stringify({ "uid": uid, "type": taskType });
    
        let res = await this.http(url, this.headers, payload, proxy);
        if (res.status !== 200) {
            this.log(`Lỗi khi hoàn thành nhiệm vụ ${taskType}! Status: ${res.status}`, 'error');
            this.log(`Response: ${JSON.stringify(res.data)}`, 'error');
            return false;
        }
    
        const rewardClaimed = await this.claimReward(uid, taskType, proxy);
        return rewardClaimed;
    }
    
    async claimReward(uid, taskType, proxy) {
        const url = "https://tgapp-api.matchain.io/api/tgapp/v1/point/task/claim";
        const payload = JSON.stringify({ "uid": uid, "type": taskType });
    
        let res = await this.http(url, this.headers, payload, proxy);
        if (res.status !== 200) {
            this.log(`Lỗi khi nhận phần thưởng nhiệm vụ ${taskType}! Status: ${res.status}`, 'error');
            this.log(`Response: ${JSON.stringify(res.data)}`, 'error');
            return false;
        }
    
        if (res.data.code === 200 && res.data.data === 'success') {
            this.log(`${'Làm nhiệm vụ'.yellow} ${taskType.white} ... ${'Trạng thái:'.white} ${'Hoàn thành'.green}`);
        } else {
            this.log(`${'Làm nhiệm vụ'.yellow} ${taskType.white} ... ${'Trạng thái:'.white} ${'Thất bại'.red}`);
            this.log(`Response: ${JSON.stringify(res.data)}`, 'error');
            return false;
        }
    
        return true;
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

	async buyTicket(token, userId) {
		const url = 'https://tgapp-api.matchain.io/api/tgapp/v1/daily/task/purchase';
		const headers = {
			...this.headers,
			'Authorization': token
		};
		const payload = {
			"uid": userId,
			"type": "game"
		};

		try {
			const response = await this.http(url, headers, JSON.stringify(payload), this.proxy);
			return response.data;
		} catch (error) {
			if (error.response && error.response.status === 401) {
				this.log("JSON Decode Error: Token Invalid", 'error');
			} else {
				this.log(`Request Error: ${error.message}`, 'error');
			}
			return null;
		}
	}

	async buyBooster(token, userId) {
		const url = 'https://tgapp-api.matchain.io/api/tgapp/v1/daily/task/purchase';
		const headers = {
			...this.headers,
			'Authorization': token
		};
		const payload = {
			"uid": userId,
			"type": "daily"
		};

		try {
			const response = await this.http(url, headers, JSON.stringify(payload), this.proxy);
			return response.data;
		} catch (error) {
			if (error.response && error.response.status === 401) {
				this.log("JSON Decode Error: Token Invalid", 'error');
			} else {
				this.log(`Request Error: ${error.message}`, 'error');
			}
			return null;
		}
	}

	async checkDailyTaskStatus() {
		const url = "https://tgapp-api.matchain.io/api/tgapp/v1/daily/task/status";
		try {
			const response = await this.http(url, this.headers, null, this.proxy);
			if (response.status !== 200 || !response.data || !response.data.data) {
				this.log('Lỗi khi kiểm tra trạng thái nhiệm vụ hàng ngày', 'error');
				return null;
			}

			const taskData = response.data.data;
			const dailyTask = taskData.find(task => task.type === 'daily');
			const gameTask = taskData.find(task => task.type === 'game');

			return {
				dailyNeedsPurchase: dailyTask && dailyTask.current_count < dailyTask.task_count,
				gameNeedsPurchase: gameTask && gameTask.current_count < gameTask.task_count
			};
		} catch (error) {
			this.log(`Lỗi khi kiểm tra trạng thái nhiệm vụ: ${error.message}`, 'error');
			return null;
		}
	}

    async main() {
        const args = require('minimist')(process.argv.slice(2));
        if (!args['--marin']) {
            if (os.platform() === 'win32') {
                execSync('cls', { stdio: 'inherit' });
            } else {
                execSync('clear', { stdio: 'inherit' });
            }
        }
        this.autogame = true;


        const proxies = this.load_proxies(args['--proxy'] || 'proxy.txt');

        while (true) {
            const dataFile = path.join(__dirname, './../data/nomis.txt');
            const proxyFile = path.join(__dirname, './../data/proxy.txt');
            const data = fs.readFileSync(dataFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
            this.listProxies = fs.readFileSync(proxyFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);

            const list_countdown = [];
            const start = Math.floor(Date.now() / 1000);
            for (let [no, item] of data.entries()) {
                const proxy = proxies[no % proxies.length];
                const parser = this.dancay(item);
                const userEncoded = decodeURIComponent(parser['user']);
                let user;
                try {
                    user = JSON.parse(userEncoded);
                } catch (error) {
                    this.log('Không thể phân tích JSON', 'error');
                    continue;
                }
				let proxyIP = '';
				try {
					proxyIP = await this.checkProxyIP(proxy);
					console.log(`========== Tài khoản ${no + 1} | ${user['first_name'].green} | IP: ${proxyIP} ==========`);
					const result = await this.login(item, proxy);
					if (result) {
						list_countdown.push(result);
						await this.countdown(3);
					}
				} catch (error) {
					this.log(`Lỗi proxy cho tài khoản ${no + 1}: ${error.message}`, 'error');
					this.log('Chuyển sang tài khoản tiếp theo...', 'warning');
					continue;
				}
            }

            const end = Math.floor(Date.now() / 1000);
            const total = end - start;
            const min = Math.min(...list_countdown) - total;
            if (min <= 0) {
                continue;
            }

            await this.countdown(min);
        }
    }

    async countdown(t) {
        while (t) {
            const hours = String(Math.floor(t / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
            const seconds = String(t % 60).padStart(2, '0');
            process.stdout.write(`[*] Chờ ${hours}:${minutes}:${seconds}     \r`.gray);
            await new Promise(resolve => setTimeout(resolve, 1000));
            t -= 1;
        }
        process.stdout.write('\r');
    }
}

if (require.main === module) {
    const app = new Matchain();
    app.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
