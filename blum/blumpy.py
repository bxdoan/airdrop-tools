import requests
from requests.structures import CaseInsensitiveDict
import time
import datetime
from colorama import init, Fore, Style
init(autoreset=True)

def get_new_token(query_id):
    import json
    headers = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "origin": "https://telegram.blum.codes",
        "priority": "u=1, i",
        "referer": "https://telegram.blum.codes/"
    }

    data = json.dumps({"query": query_id})

    url = "https://gateway.blum.codes/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP"

    for attempt in range(3):
        print(f"\r{Fore.YELLOW+Style.BRIGHT}Lấy token...", end="", flush=True)
        response = requests.post(url, headers=headers, data=data)
        if response.status_code == 200:
            print(f"\r{Fore.GREEN+Style.BRIGHT}Token tạo thành công", end="", flush=True)
            response_json = response.json()
            return response_json['token']['refresh']
        else:
            print(response.json())
            print(f"\r{Fore.RED+Style.BRIGHT}Lấy token thất bại, thử lại lần thứ {attempt + 1}", flush=True)
    print(f"\r{Fore.RED+Style.BRIGHT}Lấy token thất bại sau 3 lần thử.", flush=True)
    return None

def get_user_info(token):

    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://telegram.blum.codes',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.get('https://gateway.blum.codes/v1/user/me', headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        hasil = response.json()
        if hasil['message'] == 'Token is invalid':
            print(f"{Fore.RED+Style.BRIGHT}Token không hợp lệ, đang lấy token mới...")
            new_token = get_new_token()
            if new_token:
                print(f"{Fore.GREEN+Style.BRIGHT}Đã có token mới, thử lại...")
                return get_user_info(new_token)  
            else:
                print(f"{Fore.RED+Style.BRIGHT}Lấy token mới thất bại.")
                return None
        else:
            print(f"{Fore.RED+Style.BRIGHT}Không thể lấy thông tin người dùng")
            return None

# Hàm để lấy số dư
def get_balance(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://telegram.blum.codes',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.get('https://game-domain.blum.codes/api/v1/user/balance', headers=headers)
    return response.json()

# Hàm để chơi game
def play_game(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://telegram.blum.codes',
        'content-length': '0',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.post('https://game-domain.blum.codes/api/v1/game/play', headers=headers)
    return response.json()

# Hàm để nhận phần thưởng game
def claim_game(token, game_id, points):
    url = "https://game-domain.blum.codes/api/v1/game/claim"

    headers = CaseInsensitiveDict()
    headers["accept"] = "application/json, text/plain, */*"
    headers["accept-language"] = "en-US,en;q=0.9"
    headers["authorization"] = "Bearer "+token
    headers["content-type"] = "application/json"
    headers["origin"] = "https://telegram.blum.codes"

    headers["priority"] = "u=1, i"
    headers["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"
    data = '{"gameId":"'+game_id+'","points":'+str(points)+'}'

    resp = requests.post(url, headers=headers, data=data)
    return resp  



def claim_balance(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'content-length': '0',
        'origin': 'https://telegram.blum.codes',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.post('https://game-domain.blum.codes/api/v1/farming/claim', headers=headers)
    return response.json()

# Fungsi untuk memulai farming
def start_farming(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'content-length': '0',
        'origin': 'https://telegram.blum.codes',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.post('https://game-domain.blum.codes/api/v1/farming/start', headers=headers)
    return response.json()

def refresh_token(old_refresh_token):
    url = 'https://gateway.blum.codes/v1/auth/refresh'
    headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'origin': 'https://telegram.blum.codes',
        'referer': 'https://telegram.blum.codes/'
    }
    data = {
        'refresh': old_refresh_token
    }
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"{Fore.RED+Style.BRIGHT}Không thể làm mới: {old_refresh_token}")
        return None  

def check_balance_friend(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://telegram.blum.codes',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24", "Microsoft Edge WebView2";v="125"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.get('https://gateway.blum.codes/v1/friends/balance', headers=headers)
    balance_info = response.json()
    return balance_info



def claim_balance_friend(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'content-length': '0',
        'origin': 'https://telegram.blum.codes',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24", "Microsoft Edge WebView2";v="125"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
    }
    response = requests.post('https://gateway.blum.codes/v1/friends/claim', headers=headers)
    return response.json()


def check_daily_reward(token):
    headers = {
        'Authorization': f'Bearer {token}',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://telegram.blum.codes',
        'content-length': '0',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
        'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24", "Microsoft Edge WebView2";v="125"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site'
    }
    response = requests.post('https://game-domain.blum.codes/api/v1/daily-reward?offset=-420', headers=headers)
    try:
        return response.json()
    except ValueError:  
        print(f"{Fore.RED+Style.BRIGHT}Không thể nhận phần thưởng hàng ngày")
        return None

with open('query.txt', 'r') as file:
    query_ids = file.read().splitlines()
while True:
    for query_id in query_ids:
        token = get_new_token(query_id) 
        user_info = get_user_info(token)
        if user_info is None:
            continue
        print(f"{Fore.BLUE+Style.BRIGHT}\r==================[{Fore.WHITE+Style.BRIGHT}{user_info['username']}{Fore.BLUE+Style.BRIGHT}]==================")  
        balance_info = get_balance(token)
        print(f"\r{Fore.YELLOW+Style.BRIGHT}Đang lấy thông tin....\n", end="", flush=True)
        if balance_info:
            print(f"\r{Fore.YELLOW+Style.BRIGHT}[Số dư]: {balance_info['availableBalance']}\n", flush=True)
            print(f"{Fore.RED+Style.BRIGHT}[Vé chơi game]: {balance_info['playPasses']}")
        else:
            print(f"\r{Fore.RED+Style.BRIGHT}Không thể lấy thông tin số dư")
        farming_info = balance_info.get('farming')
        if farming_info:
            end_time_ms = farming_info['endTime']
            end_time_s = end_time_ms / 1000.0
            end_utc_date_time = datetime.datetime.fromtimestamp(end_time_s, datetime.timezone.utc)
            current_utc_time = datetime.datetime.now(datetime.timezone.utc)
            time_difference = end_utc_date_time - current_utc_time
            hours_remaining = int(time_difference.total_seconds() // 3600)
            minutes_remaining = int((time_difference.total_seconds() % 3600) // 60)
            print(f"Thời gian nhận faming: {hours_remaining} giờ {minutes_remaining} phút | Số token: {farming_info['balance']}")
        else:
            print(f"{Fore.RED+Style.BRIGHT}Thông tin về farming không có sẵn")
            hours_remaining = 0
            minutes_remaining = 0
        print(f"\r{Fore.YELLOW+Style.BRIGHT}Đang kiểm tra phần thưởng hàng ngày...", end="", flush=True)
        daily_reward_response = check_daily_reward(token)
        if daily_reward_response is None:
            print(f"\r{Fore.RED+Style.BRIGHT}Không thể kiểm tra phần thưởng hàng ngày, thử lại...", flush=True)
        else:
            if daily_reward_response['message'] == 'same day':
                print(f"\r{Fore.RED+Style.BRIGHT}Phần thưởng hàng ngày đã được nhận hôm nay", flush=True)
            elif daily_reward_response['message'] == 'OK':
                print(f"\r{Fore.GREEN+Style.BRIGHT}Phần thưởng hàng ngày đã được nhận thành công!", flush=True)


        if hours_remaining < 0:
            print(f"\r{Fore.GREEN+Style.BRIGHT}Đang nhận số dư...", end="", flush=True)
            claim_response = claim_balance(token)
            if claim_response:
                print(f"\r{Fore.GREEN+Style.BRIGHT}Đã nhận: {claim_response['availableBalance']}                ", flush=True)
                print(f"\r{Fore.GREEN+Style.BRIGHT}Bắt đầu farming...", end="", flush=True)
                start_response = start_farming(token)
                if start_response:
                    print(f"\r{Fore.GREEN+Style.BRIGHT}Farming đã bắt đầu.", flush=True)
                else:
                    print(f"\r{Fore.RED+Style.BRIGHT}Không thể bắt đầu farming", start_response.status_code, flush=True)
            else:
                print(f"\r{Fore.RED+Style.BRIGHT}Không thể nhận", claim_response.status_code, flush=True)
        print(f"\r{Fore.YELLOW+Style.BRIGHT}Đang kiểm tra số dư bạn bè...", end="", flush=True)
        friend_balance = check_balance_friend(token)
        if friend_balance:
            if friend_balance['canClaim']:
                print(f"\r{Fore.GREEN+Style.BRIGHT}Số dư bạn bè: {friend_balance['amountForClaim']}", flush=True)
                print(f"\n\r{Fore.GREEN+Style.BRIGHT}Đang nhận số dư bạn bè.....", flush=True)
                claim_friend_balance = claim_balance_friend(token)
                if claim_friend_balance:
                    claimed_amount = claim_friend_balance['claimBalance']
                    print(f"\r{Fore.GREEN+Style.BRIGHT}Nhận thành công: {claimed_amount}", flush=True)
                else:
                    print(f"\r{Fore.RED+Style.BRIGHT}Không thể nhận số dư bạn bè", flush=True)
            else:

                can_claim_at = friend_balance.get('canClaimAt')
                if can_claim_at:
                    claim_time = datetime.datetime.fromtimestamp(int(can_claim_at) / 1000)
                    current_time = datetime.datetime.now()
                    time_diff = claim_time - current_time
                    hours, remainder = divmod(int(time_diff.total_seconds()), 3600)
                    minutes, seconds = divmod(remainder, 60)
                    print(f"{Fore.RED+Style.BRIGHT}\rSố dư bạn bè: Có thể nhận sau {hours} giờ {minutes} phút", flush=True)
                else:
                    print(f"{Fore.RED+Style.BRIGHT}\rSố dư bạn bè: Tài khoản không có bạn bè", flush=True)
        else:
            print(f"{Fore.RED+Style.BRIGHT}\rKhông thể kiểm tra số dư bạn bè", flush=True)
        while balance_info['playPasses'] > 0:
            print(f"{Fore.CYAN+Style.BRIGHT}Đang chơi game...")
            game_response = play_game(token)
            print(f"\r{Fore.CYAN+Style.BRIGHT}Đang kiểm tra game...", end="", flush=True)
            time.sleep(1)
            claim_response = claim_game(token, game_response['gameId'], 2000)
            if claim_response is None:
                print(f"\r{Fore.RED+Style.BRIGHT}Không thể nhận phần thưởng game, thử lại...", flush=True)
            while True:
                if claim_response.text == '{"message":"game session not finished"}':
                    time.sleep(1) 
                    print(f"\r{Fore.RED+Style.BRIGHT}Game chưa kết thúc.. chơi tiếp", flush=True)
                    claim_response = claim_game(token, game_response['gameId'], 2000)
                    if claim_response is None:
                        print(f"\r{Fore.RED+Style.BRIGHT}Không thể nhận phần thưởng game, thử lại...", flush=True)
                elif claim_response.text == '{"message":"game session not found"}':
                    print(f"\r{Fore.RED+Style.BRIGHT}Game đã kết thúc", flush=True)
                    break
                elif 'message' in claim_response and claim_response['message'] == 'Token is invalid':
                    print(f"{Fore.RED+Style.BRIGHT}Token không hợp lệ, lấy token mới...")
                    token = get_new_token(query_id)  
                    continue  
                else:
                    print(f"\r{Fore.YELLOW+Style.BRIGHT}Game kết thúc: {claim_response.text}", flush=True)
                    break
            balance_info = get_balance(token)
            if balance_info['playPasses'] > 0:
                print(f"\r{Fore.GREEN+Style.BRIGHT}Vé vẫn còn, chơi game tiếp...", flush=True)
                continue 
            else:
                print(f"\r{Fore.RED+Style.BRIGHT}Không còn vé.", flush=True)
                break

        
    print(f"\n{Fore.GREEN+Style.BRIGHT}========={Fore.WHITE+Style.BRIGHT}Tất cả tài khoản đã được xử lý thành công{Fore.GREEN+Style.BRIGHT}=========", end="", flush=True)
    print(f"\r\n\n{Fore.GREEN+Style.BRIGHT}Làm mới token...", end="", flush=True)
    import sys
    thời_gian_chờ = 30 
    for giây in range(thời_gian_chờ, 0, -1):
        sys.stdout.write(f"\r{Fore.CYAN}Chờ thời gian nhận tiếp theo trong {Fore.CYAN}{Fore.WHITE}{giây // 60} phút {Fore.WHITE}{giây % 60} giây")
        sys.stdout.flush()
        time.sleep(1)
    sys.stdout.write("\rĐã đến thời gian nhận tiếp theo!\n")
