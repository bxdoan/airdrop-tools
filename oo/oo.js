const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');

class CatsAPI {
    constructor() {
        this.baseURL = 'https://01373265.moonberg.ai';
    }

    headers(authorization) {
        return {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Authorization': `Bearer ${authorization}`,
            'Referer': 'https://01373265.moonberg.ai/',
            'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        };
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

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            const timestamp = new Date().toLocaleTimeString();
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async getUserInfo(authorization) {
        const url = `${this.baseURL}/api/me/info`;
        const headers = this.headers(authorization);
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            this.log(`Không lấy được info user: ${error.message}`, 'error');
            throw error;
        }
    }

    extractFirstName(authorization) {
        try {
            const params = new URLSearchParams(authorization);
            const userString = params.get('user');
            if (userString) {
                const userObject = JSON.parse(decodeURIComponent(userString));
                return userObject.first_name;
            }
            return 'Unknown';
        } catch (error) {
            this.log(`Không đọc được dữ liệu: ${error.message}`, 'error');
            return 'Unknown';
        }
    }

    async getTasks(authorization) {
        const url = `${this.baseURL}/api/tasks?filters=%7B%7D`;
        const headers = this.headers(authorization);
        try {
            const response = await axios.get(url, { headers });
            return response.data.filter(task => !task.is_passed);
        } catch (error) {
            this.log(`Không lấy được danh sách nhiệm vụ: ${error.message}`, 'error');
            throw error;
        }
    }

    async completeTask(authorization, taskId, taskTitle) {
        const url = `${this.baseURL}/t_${taskId.replace(/-/g, '')}`;
        const headers = this.headers(authorization);
        try {
            const response = await axios.get(url, { headers });
            if (response.data.type === 'fail') {
                this.log(`Làm nhiệm vụ ${taskTitle} thất bại ${response.data.code}`, 'error');
            } else {
                this.log(`Làm nhiệm vụ ${taskTitle} thành công`, 'success');
            }
        } catch (error) {
            this.log(`Lỗi hoàn thành nhiệm vụ ${taskTitle}: ${error.message}`, 'error');
        }
    }

    async main() {
        const dataFile = 'data.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let no = 0; no < data.length; no++) {
                const authorization = data[no];
                const firstName = this.extractFirstName(authorization);

                try {
                    const userInfo = await this.getUserInfo(authorization);
                    console.log(`========== Tài khoản ${no + 1} | ${firstName} ==========`.green);
                    this.log(`Tuổi tài khoản: ${userInfo.account_age.white}`, 'success');
                    this.log(`Balance: ${userInfo.points.toString().white}`, 'success');
                    this.log(`Đã điểm danh liên tục ${userInfo.streak_days.toString().yellow} ngày`, 'custom');

                    const tasks = await this.getTasks(authorization);
                    for (const task of tasks) {
                        await this.completeTask(authorization, task.id, task.title);
                    }

                } catch (error) {
                    this.log(`Lỗi xử lý tài khoản ${no + 1}: ${error.message}`, 'error');
                }
            }

            await this.waitWithCountdown(1440 * 60);
        }
    }
}

if (require.main === module) {
    const catsAPI = new CatsAPI();
    catsAPI.main().catch(err => {
        catsAPI.log(err.message, 'error');
        process.exit(1);
    });
}