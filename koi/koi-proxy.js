const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DateTime } = require('luxon');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class KoiPet {
    constructor() {
        this.missionChoices = {};
        this.proxies = this.loadProxies();
        this.indexProxies = 0;
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, './../data/proxy.txt');
        return fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
    }

    formatProxy(proxy) {
        // from ip:port:user:pass to http://user:pass@ip:port
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

    getProxy() {
        const proxy = this.proxies[this.indexProxies];
        this.indexProxies++;
        if (this.indexProxies >= this.proxies.length) {
          this.indexProxies = 0;
        }
        return proxy;
    }

    getAxiosInstance(token, proxy) {
        const httpsAgent = new HttpsProxyAgent(proxy);
        
        return axios.create({
            httpsAgent,
            headers: this.headers(token)
        });
    }

    headers(token) {
        return {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Origin": "https://x.com",
            "Referer": "https://x.com/",
            "Sec-Ch-Ua": '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        }
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

    async getPets(token, proxy) {
        const url = "https://api.koi.pet/me/pets";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        return axiosInstance.get(url);
    }

    async stopFarming(token, petId, proxy) {
        const url = "https://api.koi.pet/pets/farm";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        const payload = { userPetId: petId };
        return axiosInstance.post(url, payload);
    }

    async getAvailableMissions(token, petId, proxy) {
        const url = `https://api.koi.pet/pets/adventure?petId=${petId}`;
        const axiosInstance = this.getAxiosInstance(token, proxy);
        return axiosInstance.get(url);
    }

    async startAdventure(token, userPetId, missionId, proxy) {
        const url = "https://api.koi.pet/pets/adventure/start";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        const payload = { userPetId, missionId };
        this.log(`Bắt đầu phiêu lưu cho pet ${userPetId}, nhiệm vụ ${missionId}`, 'info');
        try {
            const response = await axiosInstance.post(url, payload);
            
            if (response.data.success) {
                this.log(`Phiêu lưu bắt đầu thành công cho pet ${userPetId}`, 'success');
                if (response.data.message.currentAdventure) {
                    await this.progressAdventure(token, userPetId, response.data.message.currentAdventure, missionId, proxy);
                } else {
                    this.log(`Không có thông tin phiêu lưu hiện tại`, 'warning');
                }
            }
            
            return response;
        } catch (error) {
//            this.log(`Lỗi khi bắt đầu phiêu lưu: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async progressAdventure(token, userPetId, currentAdventure, missionId, proxy) {
        if (!this.missionChoices[missionId]) {
            this.missionChoices[missionId] = [];
        }
    
        let currentStep = 0;
    
        while (true) {
            if (currentAdventure && currentAdventure.options) {
                this.log(`Tình huống hiện tại: ${currentAdventure.text}`, 'info');
                
                let choiceIndex;
                if (currentStep < this.missionChoices[missionId].length) {
                    choiceIndex = this.missionChoices[missionId][currentStep];
                } else {
                    choiceIndex = Math.floor(Math.random() * currentAdventure.options.length);
                    this.missionChoices[missionId].push(choiceIndex);
                }
    
                this.log(`Chọn lựa chọn ${choiceIndex + 1}: ${currentAdventure.options[choiceIndex].text}`, 'info');
                
                try {
                    const choiceResponse = await this.makeAdventureChoice(token, userPetId, choiceIndex, proxy);
                    
                    if (choiceResponse.data.success) {
                        const message = choiceResponse.data.message;
                        if (message.adventureOutcome === "complete") {
                            this.log(`Hoàn thành mission: ${message.resultMessage}`, 'success');
                            this.log(`Phần thưởng: ${Object.entries(message.rewards).map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join(' | ')}`, 'info');
                            delete this.missionChoices[missionId];
                            
                            const updatedPetResponse = await this.getPets(token, proxy);
                            const updatedPet = updatedPetResponse.data.message.find(p => p.id === userPetId);
                            
                            if (updatedPet) {
                                const missionsResponse = await this.getAvailableMissions(token, userPetId, proxy);
                                if (missionsResponse.data.success && Array.isArray(missionsResponse.data.message.availableMissions)) {
                                    const suitableMission = missionsResponse.data.message.availableMissions.find(mission => {
                                        const hungerCost = Math.abs(mission.possibleRewards.Hunger.max);
                                        return updatedPet.hunger >= hungerCost;
                                    });
    
                                    if (suitableMission) {
                                        this.log(`Hunger đủ để bắt đầu phiêu lưu mới`, 'info');
                                        return this.startAdventure(token, userPetId, suitableMission.id, proxy);
                                    } else {
                                        this.log(`Không đủ hunger để bắt đầu phiêu lưu mới!`, 'warning');
                                        this.log(`Bắt đầu farming...`, 'warning');
                                        return this.stopFarming(token, userPetId, proxy);
                                    }
                                }
                            }
                            
                            break;
                        } else if (message.adventureOutcome === "fail") {
                            this.log(`Mission thất bại: ${message.resultMessage}`, 'warning');
                            this.log(`Phần thưởng: ${Object.entries(message.rewards).map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join(' | ')}`, 'info');
                            
                            this.missionChoices[missionId][currentStep] = (this.missionChoices[missionId][currentStep] + 1) % currentAdventure.options.length;
                            this.log(`Thử lại nhiệm vụ với lựa chọn mới`, 'info');
                            return this.startAdventure(token, userPetId, missionId, proxy);
                        } else if (message.nextScene) {
                            currentAdventure = message.nextScene;
                            currentStep++;
                            this.log(`Chuyển sang tình huống tiếp theo`, 'info');
                        } else {
                            this.log(`Kết quả lựa chọn không xác định`, 'warning');
                            this.log(`Dữ liệu phản hồi: ${JSON.stringify(choiceResponse.data)}`, 'info');
                            break;
                        }
                    } else {
                        this.log(`Lựa chọn thất bại: ${choiceResponse.data.message}`, 'error');
                        break;
                    }
                } catch (error) {
                    this.log(`Lỗi khi thực hiện lựa chọn: ${error.message}`, 'error');
                    break;
                }
            } else {
                this.log(`Không còn lựa chọn hoặc thông tin phiêu lưu không hợp lệ`, 'warning');
                break;
            }
        }
    }

    async makeAdventureChoice(token, userPetId, choiceIndex, proxy) {
        const url = "https://api.koi.pet/pets/adventure/choice";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        const payload = { userPetId, choiceIndex };
        return axiosInstance.post(url, payload);
    }

    async getStoreItems(token, proxy) {
        const url = "https://api.koi.pet/store/items";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        return axiosInstance.get(url);
    }

    async buyItem(token, itemId, quantity, proxy) {
        const url = "https://api.koi.pet/store/order";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        const payload = { itemId, quantity };
        return axiosInstance.post(url, payload);
    }

    async getInventory(token, proxy) {
        const url = "https://api.koi.pet/me/inventory";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        return axiosInstance.get(url);
    }

    async useItem(token, userPetId, itemId, quantity, proxy) {
        const url = "https://api.koi.pet/pets/useitem";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        const payload = { userPetId, itemId, quantity };
        return axiosInstance.post(url, payload);
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
            process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async buyFoodForPet(token, pet, proxy) {
        this.log(`Đang mua thức ăn cho pet ${pet.id}...`.yellow);
        try {
            const storeResponse = await this.getStoreItems(token, proxy);
            if (storeResponse.data.success && Array.isArray(storeResponse.data.message)) {
                const suitableFood = storeResponse.data.message.find(item => 
                    item.dietRestriction === pet.dietType
                );

                if (suitableFood) {
                    const buyResponse = await this.buyItem(token, suitableFood.id, 1, proxy);
                    if (buyResponse.data.success) {
                        this.log(`Mua item ${suitableFood.name} thành công cho pet ${pet.id}`.green);
                        return true;
                    } else {
                        this.log(`Không thể mua item cho pet ${pet.id}`.red);
                    }
                } else {
                    this.log(`Không tìm thấy thức ăn phù hợp cho pet ${pet.id}`.red);
                }
            }
        } catch (storeError) {
            this.log(`Không đủ balance để mua thức ăn hoặc lỗi không mong muốn!`.red);
        }
        return false;
    }

    async useItemsForPet(token, pet, proxy) {
        this.log(`Đang sử dụng item cho pet ${pet.id}...`, 'yellow');
        try {
            let currentHunger = pet.hunger; 
            this.log(`Hunger ban đầu của pet ${pet.id}: ${currentHunger}`, 'info');
    
            const inventoryResponse = await this.getInventory(token, proxy);
            if (inventoryResponse.data.success && Array.isArray(inventoryResponse.data.message)) {
                const inventory = inventoryResponse.data.message;
    
                const sortedItems = inventory.sort((a, b) => {
                    const hungerA = a.metadata.find(m => m.key === 'hunger')?.value || 0;
                    const hungerB = b.metadata.find(m => m.key === 'hunger')?.value || 0;
                    return hungerB - hungerA;
                });
    
                for (const item of sortedItems) {
                    const hungerValue = item.metadata.find(m => m.key === 'hunger')?.value || 0;
                    
                    if (hungerValue > 0) {
                        const neededQuantity = Math.min(
                            Math.ceil((100 - currentHunger) / hungerValue),
                            item.quantity
                        );
    
                        if (neededQuantity > 0) {
                            try {
                                const useItemResponse = await this.useItem(token, pet.id, item.itemId, neededQuantity, proxy);
                                if (useItemResponse.data.success) {
                                    currentHunger = Math.min(100, currentHunger + (hungerValue * neededQuantity));
                                    this.log(`Sử dụng ${neededQuantity} ${item.name} thành công cho pet ${pet.id}. Hunger hiện tại: ${currentHunger}`, 'success');
                                } else {
                                    this.log(`Không thể sử dụng ${item.name} cho pet ${pet.id}`, 'error');
                                }
                            } catch (useItemError) {
//                                this.log(`Lỗi khi sử dụng ${item.name} cho pet ${pet.id}: ${useItemError.message}`, 'error');
                            }
                        }
    
                        if (currentHunger >= 100) {
                            break;
                        }
                    } else if (item.itemId !== 10) {
                        try {
                            const useItemResponse = await this.useItem(token, pet.id, item.itemId, item.quantity, proxy);
                            if (useItemResponse.data.success) {
                                this.log(`Sử dụng ${item.quantity} ${item.name} thành công cho pet ${pet.id}`, 'success');
                            } else {
                                this.log(`Không thể sử dụng ${item.name} cho pet ${pet.id}`, 'error');
                            }
                        } catch (useItemError) {
                            this.log(`Lỗi khi sử dụng ${item.name} cho pet ${pet.id}: ${useItemError.message}`, 'error');
                        }
                    }
                }
            }
        } catch (inventoryError) {
            this.log(`Lỗi khi lấy danh sách item cho pet ${pet.id}: ${inventoryError.message}`, 'error');
        }
    }

    async spinWheel(token, proxy) {
        const url = "https://api.koi.pet/store/spinner/roll";
        const axiosInstance = this.getAxiosInstance(token, proxy);
        
        while (true) {
            try {
                const response = await axiosInstance.post(url, {});
                
                if (response.data.success) {
                    const reward = response.data.message;
                    if (reward.type === "item") {
                        this.log(`Spin thành công, nhận được item ${reward.itemId} (số lượng: ${reward.quantity})`, 'success');
                    } else if (reward.type === "petbux") {
                        this.log(`Spin thành công, nhận được ${reward.quantity} Petbux`, 'success');
                    } else {
                        this.log(`Spin thành công, nhận được ${reward.quantity} ${reward.type}`, 'success');
                    }
                } else {
                    this.log(`Spin không thành công: ${response.data.message}`, 'warning');
                    break;
                }
            } catch (error) {
                this.log(`Không còn lượt spin!`, 'warning');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async main() {
        const tokens = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
    
        while (true) {
            const dataFile = path.join(__dirname, './../data/koi.txt');
            const tokens = fs.readFileSync(dataFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);

            for (let no = 0; no < tokens.length; no++) {
                const token = tokens[no];
                const proxy = this.formatProxy(this.getProxy());
    
                try {
                    let proxyIP = 'Unknown';
                    try {
                        proxyIP = await this.checkProxyIP(proxy);
                    } catch (proxyError) {
                        this.log(`Lỗi khi kiểm tra IP của proxy: ${proxyError.message}`, 'warning');
                    }

                    console.log(`========== Tài khoản ${no + 1} | ip: ${proxyIP} ==========`.green);
                    
                    const response = await this.getPets(token, proxy);
                    
                    if (response.data.success && Array.isArray(response.data.message)) {
                        let pets = response.data.message;
                        
                        for (const pet of pets) {
                            this.log(`Pet Id: ${pet.id}`, 'info');
                            this.log(`Trạng thái Farming: ${pet.status}`, 'info');
    
                            if (pet.status === "Farming") {
                                try {
                                    const farmResponse = await this.stopFarming(token, pet.id, proxy);
                                    if (farmResponse.data.success && farmResponse.data.message.pet.status === "Idle") {
                                        this.log(`Tắt farming thành công cho pet ${pet.id}`, 'success');
                                        pet.status = "Idle"; 
                                    } else {
                                        this.log(`Không thể tắt farming cho pet ${pet.id}`, 'error');
                                    }
                                } catch (farmError) {
                                    this.log(`Lỗi khi tắt farming cho pet ${pet.id}: ${farmError.message}`, 'error');
                                }
                            }
                            
                            this.log(`Hunger: ${pet.hunger}`, 'info');
                            this.log(`Thức ăn: ${pet.dietType}`, 'info');
                        }
    
                        const refreshResponse = await this.getPets(token, proxy);
                        if (refreshResponse.data.success && Array.isArray(refreshResponse.data.message)) {
                            pets = refreshResponse.data.message;
                        }
                        
                        await this.spinWheel(token, proxy);

                        for (const pet of pets) {
                            if (pet.status === "Idle") {
                                try {
                                    const missionsResponse = await this.getAvailableMissions(token, pet.id, proxy);
                                    if (missionsResponse.data.success && Array.isArray(missionsResponse.data.message.availableMissions)) {
                                        this.log(`Available Missions for pet ${pet.id}:`, 'info');
                                        missionsResponse.data.message.availableMissions.forEach(mission => {
                                            this.log(`Nhiệm vụ ${mission.title} | Độ khó: ${mission.difficulty}`, 'info');
                                        });
    
                                        const suitableMission = missionsResponse.data.message.availableMissions.find(mission => {
                                            const hungerCost = Math.abs(mission.possibleRewards.Hunger.max);
                                            return pet.hunger >= hungerCost;
                                        });
    
                                        if (suitableMission) {
                                            const adventureResponse = await this.startAdventure(token, pet.id, suitableMission.id, proxy);
                                            if (adventureResponse.data.success) {
                                                continue; 
                                            } else {
                                                this.log(`Không thể bắt đầu phiêu lưu cho pet ${pet.id}`, 'error');
                                            }
                                        } else {
                                            this.log(`Không có nhiệm vụ phù hợp với lượng hunger hiện tại cho pet ${pet.id}`, 'warning');
                                        }
                                    }
                                } catch (missionError) {
//                                    this.log(`Lỗi khi lấy danh sách nhiệm vụ cho pet ${pet.id}: ${missionError.message}`, 'error');
                                }
    
                                await this.buyFoodForPet(token, pet, proxy);
                                await this.useItemsForPet(token, pet, proxy);
    
                                try {
                                    const updatedPetResponse = await this.getPets(token, proxy);
                                    const updatedPet = updatedPetResponse.data.message.find(p => p.id === pet.id);
                                    
                                    const missionsResponse = await this.getAvailableMissions(token, updatedPet.id, proxy);
                                    if (missionsResponse.data.success && Array.isArray(missionsResponse.data.message.availableMissions)) {
                                        const suitableMission = missionsResponse.data.message.availableMissions.find(mission => {
                                            const hungerCost = Math.abs(mission.possibleRewards.Hunger.max);
                                            return updatedPet.hunger >= hungerCost;
                                        });
    
                                        if (suitableMission) {
                                            const adventureResponse = await this.startAdventure(token, updatedPet.id, suitableMission.id, proxy);
                                            if (adventureResponse.data.success) {
                                            } else {
                                                this.log(`Không thể bắt đầu phiêu lưu cho pet ${updatedPet.id}`, 'error');
                                            }
                                        } else {
                                            const farmResponse = await this.stopFarming(token, updatedPet.id, proxy);
                                            if (farmResponse.data.success && farmResponse.data.message.pet.status === "Farming") {
                                                this.log(`Bắt đầu farming cho pet ${updatedPet.id}`, 'success');
                                            } else {
                                                this.log(`Không thể bắt đầu farming cho pet ${updatedPet.id}`, 'error');
                                            }
                                        }
                                    }
                                } catch (error) {
//                                    this.log(`Lỗi khi xử lý pet ${pet.id} sau khi sử dụng item: ${error.message}`, 'error');
                                }
                            }
                        }
                    } else {
                        this.log('Unexpected response format', 'error');
                    }
                } catch (error) {
                    this.log(`Error processing account ${no + 1}: ${error.message}`, 'error');
                }
            }
    
            await this.waitWithCountdown(60 * 60);
        }
    }
}

if (require.main === module) {
    const koiPet = new KoiPet();
    koiPet.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}