import requests
from requests.structures import CaseInsensitiveDict
import time
import datetime
from colorama import init, Fore, Style
init(autoreset=True)

query_id= f"query_id=AAG-Ws8hAwAAAL5azyEZCwOi&user=%7B%22id%22%3A7009688254%2C%22first_name%22%3A%22at%22%2C%22last_name%22%3A%22tu%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%7D&auth_date=1724830894&hash=5a97004f59b0b5dac3a914be5578f7f18876c77dd3015757cc62a8f7774de1cd"
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


if __name__ == "__main__":
    get_new_token(query_id)
