import cloudscraper
import json
import time
from datetime import datetime
import traceback
from colorama import init, Fore, Style

init(autoreset=True)

class MidasApp:
    def __init__(self, data_file):
        self.scraper = cloudscraper.create_scraper()
        self.data_file = data_file
        self.base_url = "https://api-tg-app.midas.app/api"

    def log(self, message, color=Fore.WHITE):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"{Fore.CYAN}[{timestamp}]{Style.RESET_ALL} {color}{message}")

    def get_common_headers(self, token=None):
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Origin": "https://prod-tg-app.midas.app",
            "Referer": "https://prod-tg-app.midas.app/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def register_user(self, init_data):
        url = f"{self.base_url}/auth/register"
        headers = self.get_common_headers()
        headers["Content-Type"] = "application/json"
        payload = {"initData": init_data}
        
        response = self.scraper.post(url, headers=headers, json=payload)
        return response

    def get_user_info(self, token):
        url = f"{self.base_url}/user"
        headers = self.get_common_headers(token)
        response = self.scraper.get(url, headers=headers)
        return response

    def update_streak(self, token):
        url = f"{self.base_url}/streak"
        headers = self.get_common_headers(token)
        
        response = self.scraper.post(url, headers=headers)
        return response

    def play_game(self, token):
        url = f"{self.base_url}/game/play"
        headers = self.get_common_headers(token)
        headers["Content-Type"] = "application/json"
        
        response = self.scraper.post(url, headers=headers)
        return response

    def get_available_tasks(self, token):
        url = f"{self.base_url}/tasks/available"
        headers = self.get_common_headers(token)
        response = self.scraper.get(url, headers=headers)
        
        if response.status_code == 200:
            tasks_data = response.json()
            tasks = [
                {
                    'id': task['id'],
                    'name': task['name'],
                    'canBeClaimedAt': task['canBeClaimedAt'],
                    'waitTime': task['waitTime']
                }
                for task in tasks_data if not task['completed']
            ]
            return {'success': True, 'tasks': tasks}
        else:
            return {'success': False, 'error': f"HTTP Error: {response.status_code}"}

    def start_task(self, token, task_id):
        url = f"{self.base_url}/tasks/start/{task_id}"
        headers = self.get_common_headers(token)    
        response = self.scraper.post(url, headers=headers)
        if response:
            return {'success': True}
        else:
            return {'success': False, 'error': f"HTTP Error: {response.status_code}", 'status': response.status_code}

    def claim_task(self, token, task_id):
        url = f"{self.base_url}/tasks/claim/{task_id}"
        headers = self.get_common_headers(token)
        response = self.scraper.post(url, headers=headers)
        if response:
            return {'success': True, 'data': response.json()}
        else:
            return {'success': False, 'error': f"HTTP Error: {response.status_code}"}

    def handle_task(self, token, task):
        if 'completed' in task:
            if task['completed']:
                self.log(f"Nhiệm vụ '{task['name']}' đã hoàn thành.")
                return {'success': True, 'message': 'Task already completed'}
        elif 'state' in task:
            if task['state'] == 'COMPLETED':
                self.log(f"Nhiệm vụ '{task['name']}' đã hoàn thành.")
                return {'success': True, 'message': 'Task already completed'}
        
        if 'canBeClaimedAt' in task and task['canBeClaimedAt'] is not None:
            claim_result = self.claim_task(token, task['id'])
            if claim_result['success']:
                self.log(f"Đã nhận thưởng cho nhiệm vụ '{task['name']}'")
            else:
                self.log(f"Không thể nhận thưởng cho nhiệm vụ '{task['name']}': {claim_result['error']}")
            return claim_result
        
        start_result = self.start_task(token, task['id'])
        if not start_result['success']:
            return {'success': False, 'error': start_result['error']}
        
        if 'waitTime' in task and task['waitTime']:
            self.log(f"Chờ {task['waitTime']} giây để hoàn thành nhiệm vụ...")
            time.sleep(task['waitTime'])
        
        claim_result = self.claim_task(token, task['id'])
        if claim_result['success']:
            self.log(f"Đã hoàn thành và nhận thưởng cho nhiệm vụ '{task['name']}'")
        else:
            self.log(f"Không thể nhận thưởng cho nhiệm vụ '{task['name']}' sau khi chờ: {claim_result['error']}")
        return claim_result

    def update_visited(self, token):
        url = f"{self.base_url}/user/visited"
        headers = self.get_common_headers(token)
        
        response = self.scraper.patch(url, headers=headers)
        if response:
            self.log("Truy cập thành công")
            return {'success': True}
        else:
            self.log(f"Không thể cập nhật trạng thái truy cập. Mã lỗi: {response.status_code}")
            return {'success': False, 'error': f"HTTP Error: {response.status_code}"}

    def process_accounts(self):
        with open(self.data_file, 'r') as file:
            accounts = file.readlines()
        
        total_accounts = len(accounts)
        
        for index, init_data in enumerate(accounts, start=1):
            init_data = init_data.strip()
            
            self.log("~" * 50, Fore.YELLOW)
            self.log(f"Tài khoản: {index}/{total_accounts}", Fore.GREEN)
            
            try:
                register_response = self.register_user(init_data)
                
                if register_response.status_code == 201:
                    token = register_response.text.strip()
                else:
                    self.log(f"Failed to register user. Status code: {register_response.status_code}", Fore.RED)
                    continue
                
                streak_response = self.update_streak(token)
                
                try:
                    streak_info = streak_response.json()
                    
                    if streak_response.status_code == 200:
                        streak_days = streak_info.get('streakDaysCount', 'N/A')
                        next_points = streak_info.get('nextRewards', {}).get('points', 'N/A')
                        next_tickets = streak_info.get('nextRewards', {}).get('tickets', 'N/A')
                        
                        self.log(f"Điểm danh thành công ngày {streak_days}: phần thưởng {next_points} Points - {next_tickets} Tickets", Fore.GREEN)
                    elif streak_response.status_code == 400 and streak_info.get('message') == "Can't claim streak now":
                        self.log("Bạn đã điểm danh ngày hôm nay", Fore.YELLOW)
                    else:
                        self.log(f"Unexpected response: {streak_info.get('message', 'Unknown error')}", Fore.RED)
                except json.JSONDecodeError:
                    self.log("Failed to parse streak response as JSON", Fore.RED)
                    self.log(f"Raw streak response: {streak_response.text}", Fore.RED)

                visited_result = self.update_visited(token)
                if not visited_result['success']:
                    self.log(f"Không thể cập nhật trạng thái truy cập: {visited_result.get('error', 'Unknown error')}", Fore.RED)

                user_info_response = self.get_user_info(token)
                
                try:
                    user_info = user_info_response.json()
                except json.JSONDecodeError:
                    self.log("Failed to parse user info response as JSON", Fore.RED)
                    self.log(f"Raw user info response: {user_info_response.text}", Fore.RED)
                    continue
                
                first_name = user_info.get('firstName', 'N/A')
                points = user_info.get('points', 'N/A')
                tickets = user_info.get('tickets', 0)
                
                self.log(f"Points: {points}", Fore.CYAN)
                self.log(f"Tickets: {tickets}", Fore.CYAN)
                
                if tickets > 0:
                    for i in range(tickets):
                        game_response = self.play_game(token)
                        try:
                            game_info = game_response.json()
                            if game_response:
                                points_earned = game_info.get('points', 0)
                                self.log(f"Tap thành công: nhận {points_earned} Points", Fore.GREEN)
                            else:
                                self.log(f"Failed to play game: {game_info.get('message', 'Unknown error')}", Fore.RED)
                        except json.JSONDecodeError:
                            self.log("Failed to parse game response as JSON", Fore.RED)
                            self.log(f"Raw game response: {game_response.text}", Fore.RED)

                tasks_result = self.get_available_tasks(token)
                if tasks_result['success']:
                    for task in tasks_result['tasks']:
                        self.log(f"Đang xử lý nhiệm vụ: {task.get('name', 'Unknown task')}", Fore.YELLOW)
                        try:
                            task_result = self.handle_task(token, task)
                            if task_result['success']:
                                if 'message' in task_result:
                                    self.log(task_result['message'], Fore.GREEN)
                                else:
                                    self.log(f"Hoàn thành nhiệm vụ: {task.get('name', 'Unknown task')}", Fore.GREEN)
                            else:
                                self.log(f"Không thể hoàn thành nhiệm vụ: {task.get('name', 'Unknown task')} (chưa đủ điều kiện)", Fore.YELLOW)
                        except Exception as e:
                            self.log(f"Lỗi xử lý nhiệm vụ '{task.get('name', 'Unknown task')}': {str(e)}", Fore.RED)
                            self.log(f"Chi tiết nhiệm vụ: {json.dumps(task, indent=2)}", Fore.RED)
                else:
                    self.log(f"Không thể lấy danh sách nhiệm vụ: {tasks_result['error']}", Fore.RED)
                
            except Exception as e:
                self.log(f"Đã xảy ra lỗi cho tài khoản {index}: {str(e)}", Fore.RED)
                self.log(f"Traceback: {traceback.format_exc()}", Fore.RED)
            
            time.sleep(5)

    def run_continuously(self):
        while True:
            self.log("Tool được chia sẻ tại kênh telegram VP Airdrop (@vp_airdrop)", Fore.MAGENTA)
            self.process_accounts()
            self.log("Hoàn thành chu kỳ xử lý tài khoản", Fore.MAGENTA)
            self.log(f"Chờ 24 giờ trước khi bắt đầu chu kỳ tiếp theo...", Fore.YELLOW)
            time.sleep(86400)

if __name__ == "__main__":
    data_file = "./../data/midas.txt"
    midas_app = MidasApp(data_file)
    midas_app.run_continuously()